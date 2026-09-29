import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { ArticleCard } from '../components/ArticleCard.jsx';
import { SearchBar } from '../components/SearchBar.jsx';
import { Pagination } from '../components/Pagination.jsx';
import { SearchIcon, UsersIcon } from '../components/Icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const SORTS = [
  { key: 'latest', label: 'Latest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'most-viewed', label: 'Most viewed' },
  { key: 'most-reacted', label: 'Most reacted' },
];

export default function DiscoverPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const category = params.get('category') || '';
  const tag = params.get('tag') || '';
  const sort = params.get('sort') || 'latest';
  const feed = params.get('feed') || '';
  const page = Number(params.get('page') || 1);

  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/categories').then((d) => setCategories(d.categories)).catch(() => {});
    api.get('/api/tags?limit=20').then((d) => setTags(d.tags)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (feed === 'following') {
        const data = await api.get(`/api/articles/following?page=${page}`);
        setArticles(data.articles);
        setTotal(data.total);
        setTotalPages(data.total_pages);
        return;
      }
      const sp = new URLSearchParams();
      if (q) sp.set('q', q);
      if (category) sp.set('category', category);
      if (tag) sp.set('tag', tag);
      sp.set('sort', sort);
      sp.set('page', String(page));
      const data = await api.get(`/api/articles?${sp.toString()}`);
      setArticles(data.articles);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } finally {
      setLoading(false);
    }
  }, [q, category, tag, sort, feed, page]);

  useEffect(() => {
    load();
  }, [load]);

  const update = (obj, resetPage = true) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(obj)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (resetPage) next.delete('page');
    setParams(next, { replace: true });
  };

  return (
    <div className="container" style={{ paddingTop: 32 }}>
      <div className="page-head" style={{ padding: '24px 0 20px' }}>
        <h1>Discover</h1>
        <p className="sub">Search and browse articles by title, author, category, or topic.</p>
      </div>

      <SearchBar initial={q} />
      <div className="row" style={{ marginTop: 18, gap: 6 }}>
        {user && (
          <button
            className={`chip ${feed === 'following' ? 'active' : ''}`}
            onClick={() => update({ category: '', tag: '', feed: feed === 'following' ? '' : 'following' })}>
            <UsersIcon /> Following
          </button>
        )}
        <button
          className={`chip ${feed !== 'following' && !category && !tag ? 'active' : ''}`}
          onClick={() => update({ category: '', tag: '', feed: '' })}>
          All topics
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            className={`chip ${feed !== 'following' && category === c.slug && !tag ? 'active' : ''}`}
            onClick={() => update({ category: c.slug, tag: '', feed: '' })}>
            {c.name}
          </button>
        ))}
      </div>

      {feed === 'following' && (
        <div className="alert" style={{ marginTop: 16 }}>
          Articles from authors you follow. Follow authors from their profile pages to grow this feed.
        </div>
      )}

      {tag && (
        <div className="row" style={{ marginTop: 14 }}>
          <span className="small muted">Tag:</span>
          <button className="chip active" onClick={() => update({ tag: '' })}>#{tag} ✕</button>
        </div>
      )}

      <div className="row" style={{ margin: '20px 0', justifyContent: 'space-between' }}>
        <span className="small muted">{total} article{total !== 1 ? 's' : ''} found</span>
        {feed !== 'following' && (
          <div className="row" style={{ gap: 6 }}>
            {SORTS.map((s) => (
              <button key={s.key} className={`chip ${sort === s.key ? 'active' : ''}`} onClick={() => update({ sort: s.key })}>
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 320 }} />)}</div>
      ) : articles.length === 0 ? (
        <div className="empty-state">
          <div className="icon"><SearchIcon style={{ fontSize: '2.2rem' }} /></div>
          <h3>{feed === 'following' ? 'No articles from your follows yet' : 'No articles found'}</h3>
          <p style={{ marginTop: 6 }}>
            {feed === 'following'
              ? 'Follow authors from their profile pages to build your feed.'
              : 'Try a different search term or filter.'}
          </p>
        </div>
      ) : (
        <div className="grid">
          {articles.map((a) => <ArticleCard key={a.id} article={a} />)}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onChange={(p) => update({ page: String(p) }, false)} />
    </div>
  );
}
