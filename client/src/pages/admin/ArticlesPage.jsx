import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, formatDateTime } from '../../api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { StatusBadge } from '../../components/Badges.jsx';
import { ConfirmationModal } from '../../components/ConfirmationModal.jsx';
import { Pagination } from '../../components/Pagination.jsx';
import { SearchIcon, EyeIcon, EditIcon, CheckIcon, XIcon, ArchiveIcon, TrashIcon, StarIcon } from '../../components/Icons.jsx';

const STATUS_FILTERS = ['all', 'published', 'pending', 'draft', 'rejected', 'archived'];
const SORTS = [
  ['newest', 'Newest first'],
  ['oldest', 'Oldest first'],
  ['updated', 'Recently updated'],
];

export default function ArticlesPage() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(searchParams.get('status') || 'all');
  const [category, setCategory] = useState('all');
  const [author, setAuthor] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sp = new URLSearchParams(searchParams);
    const st = sp.get('status') || 'all';
    if (st !== status) {
      setStatus(st);
      setPage(1);
    }
  }, [searchParams]);

  useEffect(() => {
    api.get('/api/categories').then((d) => setCategories(d.categories)).catch(() => {});
  }, []);

  const setStatusFilter = (s) => {
    setStatus(s);
    setPage(1);
    const sp = new URLSearchParams(searchParams);
    if (s === 'all') sp.delete('status');
    else sp.set('status', s);
    setSearchParams(sp, { replace: true });
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (q) sp.set('q', q);
      if (status !== 'all') sp.set('status', status);
      if (category !== 'all') sp.set('category', category);
      if (author) sp.set('author', author);
      if (sort !== 'newest') sp.set('sort', sort);
      sp.set('page', String(page));
      const data = await api.get(`/api/admin/articles?${sp.toString()}`);
      setArticles(data.articles);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [q, status, category, author, sort, page]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (article, nextStatus, reason) => {
    setBusy(true);
    try {
      await api.patch(`/api/articles/${article.id}/status`, { status: nextStatus, rejection_reason: reason });
      toast(`Article ${nextStatus}`, 'success');
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.del(`/api/articles/${deleteTarget.id}`);
      toast('Article deleted', 'success');
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    await act(rejectTarget, 'rejected', rejectReason.trim() || 'Not approved');
    setRejectTarget(null);
    setRejectReason('');
  };

  const actionBtn = (article) => {
    const btns = [];
    if (article.status === 'published') {
      btns.push(
        <button
          key="feat"
          className={`btn ${article.featured ? 'btn-primary' : 'btn-outline'} btn-sm`}
          title={article.featured ? 'Remove from featured' : 'Feature on home page'}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api.post(`/api/admin/articles/${article.id}/featured`, { featured: !article.featured });
              toast(article.featured ? 'Removed from featured' : 'Featured on home page', 'success');
              load();
            } catch (e) {
              toast(e.message, 'error');
            } finally {
              setBusy(false);
            }
          }}
        >
          <StarIcon />
        </button>
      );
    }
    if (article.status === 'pending' || article.status === 'draft') {
      btns.push(
        <button key="pub" className="btn btn-success btn-sm" title="Publish" disabled={busy} onClick={() => act(article, 'published')}>
          <CheckIcon />
        </button>
      );
    }
    if (article.status === 'pending') {
      btns.push(
        <button key="rej" className="btn btn-danger-outline btn-sm" title="Reject" disabled={busy} onClick={() => { setRejectTarget(article); setRejectReason(''); }}>
          <XIcon />
        </button>
      );
    }
    if (article.status === 'published') {
      btns.push(
        <button key="arc" className="btn btn-outline btn-sm" title="Archive" disabled={busy} onClick={() => act(article, 'archived')}>
          <ArchiveIcon />
        </button>
      );
    }
    if (article.status === 'archived') {
      btns.push(
        <button key="repub" className="btn btn-outline btn-sm" title="Republish" disabled={busy} onClick={() => act(article, 'published')}>
          <CheckIcon />
        </button>
      );
    }
    btns.push(
      <Link key="view" to={`/article/${article.id}`} className="btn btn-ghost btn-sm" title="View"><EyeIcon /></Link>,
      <Link key="edit" to={`/article/${article.id}/edit`} className="btn btn-ghost btn-sm" title="Edit"><EditIcon /></Link>,
      <button key="del" className="btn btn-danger-outline btn-sm" title="Delete" onClick={() => setDeleteTarget(article)}>
        <TrashIcon />
      </button>
    );
    return btns;
  };

  return (
    <div>
      <div className="page-head" style={{ padding: '0 0 16px' }}>
        <h1>Article management</h1>
        <p className="sub">Review, publish, reject, archive, and delete articles.</p>
      </div>

      <div className="filter-bar">
        <div className="searchbar" style={{ flex: 1, minWidth: 220, maxWidth: 420 }}>
          <SearchIcon />
          <input placeholder="Search by title or author…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
        <select value={status} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--surface)' }}>
          {STATUS_FILTERS.map((s) => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s[0].toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--surface)' }}>
          <option value="all">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input
          placeholder="Filter by author…"
          value={author}
          onChange={(e) => { setAuthor(e.target.value); setPage(1); }}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--surface)', minWidth: 150 }}
        />
        <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--surface)' }}>
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <span className="small muted">{total} article{total !== 1 ? 's' : ''}</span>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Article</th>
              <th>Author</th>
              <th>Category</th>
              <th>Status</th>
              <th>Created</th>
              <th>Updated</th>
              <th>Views</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8}><div className="skeleton" style={{ height: 220 }} /></td></tr>
            )}
            {!loading && articles.length === 0 && (
              <tr><td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 32 }}>No articles match your filters.</td></tr>
            )}
            {!loading && articles.map((a) => (
              <tr key={a.id}>
                <td>
                  <Link to={`/article/${a.id}`} style={{ fontWeight: 600, display: 'block', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</Link>
                  {a.featured && <span className="badge badge-admin">Featured</span>}
                  {a.rejection_reason && <span className="small muted" style={{ color: 'var(--danger)' }}>Rejected: {a.rejection_reason}</span>}
                </td>
                <td>
                  <div style={{ fontWeight: 500 }}>{a.author_display}</div>
                  <div className="small muted">{a.author?.email}</div>
                </td>
                <td>{a.category?.name || '—'}</td>
                <td><StatusBadge status={a.status} /></td>
                <td className="small muted">{formatDateTime(a.created_at)}</td>
                <td className="small muted">{formatDateTime(a.updated_at)}</td>
                <td>{a.views_count.toLocaleString()}</td>
                <td>
                  <div className="table-actions">{actionBtn(a)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      <ConfirmationModal
        open={!!deleteTarget}
        title="Delete this article?"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This action is permanent and cannot be undone.`}
        confirmLabel="Delete article"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        busy={busy}
      />

      <ConfirmationModal
        open={!!rejectTarget}
        title="Reject article"
        message={`Reject "${rejectTarget?.title}"? It will not be published.`}
        confirmLabel="Reject"
        tone="danger"
        onConfirm={confirmReject}
        onCancel={() => setRejectTarget(null)}
        busy={busy}
      >
        <div className="field" style={{ marginTop: 14 }}>
          <label>Reason (shown to the author)</label>
          <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Why is this article being rejected?" rows={3} />
        </div>
      </ConfirmationModal>
    </div>
  );
}
