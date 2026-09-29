import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, formatDateTime, timeAgo } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { StatusBadge, RoleBadge } from '../components/Badges.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { ConfirmationModal } from '../components/ConfirmationModal.jsx';
import { Pagination } from '../components/Pagination.jsx';
import { PlusIcon, EyeIcon, EditIcon, TrashIcon, SendIcon } from '../components/Icons.jsx';

const TABS = [
  { key: 'all', label: 'My articles' },
  { key: 'draft', label: 'Drafts' },
  { key: 'pending', label: 'Pending' },
  { key: 'published', label: 'Published' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'archived', label: 'Archived' },
];

export default function UserDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'all';
  const page = Number(params.get('page') || 1);

  const [articles, setArticles] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState([]);
  const [counts, setCounts] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get(`/api/articles/mine?status=${tab}&page=${page}`);
      setArticles(data.articles);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } finally {
      setLoading(false);
    }
  }, [tab, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.get('/api/me/activities?limit=12').then((d) => setActivities(d.activities)).catch(() => {});
    Promise.all(TABS.filter((t) => t.key !== 'all').map((t) => api.get(`/api/articles/mine?status=${t.key}&limit=1`)))
      .then((results) => {
        const c = {};
        TABS.filter((t) => t.key !== 'all').forEach((t, i) => {
          c[t.key] = results[i].total;
        });
        setCounts(c);
      })
      .catch(() => {});
  }, []);

  const submitForReview = async (article) => {
    try {
      await api.patch(`/api/articles/${article.id}/status`, { status: 'pending' });
      toast('Submitted for review', 'success');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.del(`/api/articles/${deleteTarget.id}`);
      toast('Article deleted', 'success');
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const setTab = (key) => {
    const next = new URLSearchParams(params);
    next.set('tab', key);
    next.delete('page');
    setParams(next, { replace: true });
  };

  return (
    <div className="container" style={{ paddingTop: 28 }}>
      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
        <div>
          <span className="eyebrow">Your dashboard</span>
          <h1>Welcome, {user?.name.split(' ')[0]}</h1>
          <p className="sub">
            <RoleBadge role={user?.role} /> · Member since {formatDateTime(user?.created_at)}
          </p>
        </div>
        <Link to="/upload" className="btn btn-primary">
          <PlusIcon /> Upload article
        </Link>
      </div>

      <div className="dash-grid" style={{ marginTop: 24 }}>
        <aside className="dash-sidebar">
          {TABS.map((t) => (
            <Link key={t.key} to={`/dashboard?tab=${t.key}`} className={tab === t.key ? 'active' : ''} onClick={(e) => { e.preventDefault(); setTab(t.key); }}>
              {t.label}
              {counts[t.key] !== undefined && t.key !== 'all' && (
                <span style={{ marginLeft: 'auto', background: tab === t.key ? 'var(--primary)' : 'var(--bg-alt)', color: tab === t.key ? '#fff' : 'var(--ink-mute)', borderRadius: 999, padding: '1px 9px', fontSize: '0.75rem' }}>
                  {counts[t.key]}
                </span>
              )}
            </Link>
          ))}
        </aside>

        <div>
          {loading ? (
            <div className="stack">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 90 }} />)}</div>
          ) : articles.length === 0 ? (
            <div className="empty-state">
              <div className="icon"><PlusIcon style={{ fontSize: '2rem' }} /></div>
              <h3>No articles here yet</h3>
              <p style={{ marginTop: 6 }}>Write your first article and share it with the world.</p>
              <div style={{ marginTop: 16 }}>
                <Link to="/upload" className="btn btn-primary"><PlusIcon /> Upload article</Link>
              </div>
            </div>
          ) : (
            <div className="stack">
              {articles.map((a) => (
                <div key={a.id} className="list-row">
                  <div className="grow">
                    <div className="row" style={{ gap: 8, marginBottom: 2 }}>
                      <StatusBadge status={a.status} />
                      {a.category && <span className="badge badge-category">{a.category.name}</span>}
                    </div>
                    <div className="title">
                      <Link to={`/article/${a.id}`}>{a.title}</Link>
                    </div>
                    <div className="meta">
                      Updated {timeAgo(a.updated_at)} · {a.views_count.toLocaleString()} views · {a.reactions_count} reactions
                    </div>
                    {a.status === 'rejected' && a.rejection_reason && (
                      <div className="alert alert-warning" style={{ padding: '8px 12px', fontSize: '0.82rem', marginTop: 8 }}>
                        Rejected: {a.rejection_reason}
                      </div>
                    )}
                  </div>
                  <div className="table-actions">
                    <Link to={`/article/${a.id}`} className="btn btn-ghost btn-sm" title="View"><EyeIcon /></Link>
                    {a.permissions?.can_edit && (
                      <Link to={`/article/${a.id}/edit`} className="btn btn-ghost btn-sm" title="Edit"><EditIcon /></Link>
                    )}
                    {(a.status === 'draft' || a.status === 'rejected') && (
                      <button className="btn btn-primary btn-sm" title="Submit for review" onClick={() => submitForReview(a)}>
                        <SendIcon />
                      </button>
                    )}
                    {a.permissions?.can_delete && (
                      <button className="btn btn-danger-outline btn-sm" title="Delete" onClick={() => setDeleteTarget(a)}>
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <Pagination page={page} totalPages={totalPages} onChange={(p) => {
                const next = new URLSearchParams(params);
                next.set('page', String(p));
                setParams(next, { replace: true });
              }} />
            </div>
          )}

          {activities.length > 0 && (
            <div className="form-card" style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: '1.05rem', marginBottom: 12 }}>Recent activity</h3>
              <div className="stack" style={{ gap: 10 }}>
                {activities.map((a) => (
                  <div key={a.id} className="row" style={{ justifyContent: 'space-between', fontSize: '0.88rem' }}>
                    <span>
                      <span className="muted">{timeAgo(a.created_at)}</span>
                      {' · '}
                      {a.entity_title || a.action.replaceAll('.', ' ')}
                    </span>
                    <span className="badge badge-draft">{a.action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        open={!!deleteTarget}
        title="Delete this article?"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This action is permanent and cannot be undone.`}
        confirmLabel="Delete article"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        busy={deleting}
      />
    </div>
  );
}
