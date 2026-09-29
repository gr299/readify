import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, timeAgo } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import { ArticleCard } from '../components/ArticleCard.jsx';
import { Pagination } from '../components/Pagination.jsx';
import { BookmarkIcon } from '../components/Icons.jsx';

export default function SavedPage() {
  const { toast } = useToast();
  const [articles, setArticles] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/api/me/bookmarks?page=${page}`)
      .then((d) => {
        setArticles(d.articles);
        setTotal(d.total);
        setTotalPages(d.total_pages);
      })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [page]);

  const removeBookmark = async (id) => {
    try {
      await api.post(`/api/articles/${id}/bookmark`);
      setArticles((a) => a.filter((x) => x.id !== id));
      setTotal((t) => t - 1);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <div className="container" style={{ paddingTop: 28 }}>
      <div className="page-head">
        <span className="eyebrow"><BookmarkIcon /> Saved</span>
        <h1>Saved articles</h1>
        <p className="sub">{total} saved article{total !== 1 ? 's' : ''} · Saved {timeAgo(articles[0]?.updated_at)}</p>
      </div>

      {loading ? (
        <div className="grid">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 300 }} />)}</div>
      ) : articles.length === 0 ? (
        <div className="empty-state">
          <div className="icon"><BookmarkIcon style={{ fontSize: '2rem' }} /></div>
          <h3>Nothing saved yet</h3>
          <p style={{ marginTop: 6 }}>Bookmark articles you want to read later — they will appear here.</p>
          <div style={{ marginTop: 16 }}><Link to="/discover" className="btn btn-primary">Discover articles</Link></div>
        </div>
      ) : (
        <>
          <div className="grid">
            {articles.map((a) => (
              <div key={a.id} style={{ position: 'relative' }}>
                <ArticleCard article={a} />
                <button
                  className="btn btn-danger-outline btn-sm"
                  style={{ position: 'absolute', top: 10, right: 10 }}
                  onClick={() => removeBookmark(a.id)}
                  title="Remove bookmark"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
