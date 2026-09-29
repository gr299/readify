import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api, formatDate } from '../../api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { StatusBadge } from '../../components/Badges.jsx';
import { Pagination } from '../../components/Pagination.jsx';
import { SearchIcon, StarIcon } from '../../components/Icons.jsx';

export default function FeaturedPage() {
  const { toast } = useToast();
  const [featured, setFeatured] = useState([]);
  const [published, setPublished] = useState([]);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadFeatured = useCallback(async () => {
    try {
      const data = await api.get('/api/admin/featured');
      setFeatured(data.articles);
    } catch (e) {
      toast(e.message, 'error');
    }
  }, []);

  const loadPublished = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (q) sp.set('q', q);
      sp.set('status', 'published');
      sp.set('sort', 'newest');
      sp.set('page', String(page));
      const data = await api.get(`/api/admin/articles?${sp.toString()}`);
      setPublished(data.articles);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [q, page]);

  useEffect(() => {
    loadFeatured();
  }, [loadFeatured]);

  useEffect(() => {
    loadPublished();
  }, [loadPublished]);

  const toggle = async (a) => {
    setBusy(true);
    try {
      await api.post(`/api/admin/articles/${a.id}/featured`, { featured: !a.featured });
      toast(a.featured ? 'Removed from featured' : 'Added to featured', 'success');
      loadFeatured();
      loadPublished();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="page-head" style={{ padding: '0 0 16px' }}>
        <h1>Featured articles</h1>
        <p className="sub">Choose published articles to spotlight on the home page.</p>
      </div>

      <div className="form-card" style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: '1.05rem', marginBottom: 12 }}>Currently featured ({featured.length})</h3>
        {featured.length === 0 ? (
          <p className="muted" style={{ fontSize: '0.92rem' }}>No featured articles. Use the list below to feature published articles.</p>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            {featured.map((a) => (
              <div key={a.id} className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '10px 14px', background: 'var(--bg-alt)', borderRadius: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <Link to={`/article/${a.id}`} style={{ fontWeight: 600 }}>{a.title}</Link>
                  <div className="small muted">{a.author_display} · {a.views_count.toLocaleString()} views · featured {formatDate(a.featured_at || a.published_at)}</div>
                </div>
                <button className="btn btn-danger-outline btn-sm" disabled={busy} onClick={() => toggle(a)}>
                  <StarIcon /> Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="filter-bar">
        <div className="searchbar" style={{ flex: 1, minWidth: 220, maxWidth: 420 }}>
          <SearchIcon />
          <input placeholder="Search published articles…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
        <span className="small muted">{total} published article{total !== 1 ? 's' : ''}</span>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Article</th>
              <th>Author</th>
              <th>Status</th>
              <th>Published</th>
              <th>Views</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6}><div className="skeleton" style={{ height: 180 }} /></td></tr>}
            {!loading && published.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 32 }}>No published articles.</td></tr>}
            {!loading && published.map((a) => (
              <tr key={a.id}>
                <td>
                  <Link to={`/article/${a.id}`} style={{ fontWeight: 600 }}>{a.title}</Link>
                  {a.featured && <span className="badge badge-admin" style={{ marginLeft: 8 }}>Featured</span>}
                </td>
                <td>{a.author_display}</td>
                <td><StatusBadge status={a.status} /></td>
                <td className="small muted">{formatDate(a.published_at)}</td>
                <td>{a.views_count.toLocaleString()}</td>
                <td>
                  <button
                    className={`btn ${a.featured ? 'btn-danger-outline' : 'btn-primary'} btn-sm`}
                    disabled={busy}
                    onClick={() => toggle(a)}
                  >
                    <StarIcon /> {a.featured ? 'Unfeature' : 'Feature'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}
