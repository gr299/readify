import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api, formatDateTime } from '../../api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Avatar } from '../../components/Avatar.jsx';
import { ConfirmationModal } from '../../components/ConfirmationModal.jsx';
import { Pagination } from '../../components/Pagination.jsx';
import { SearchIcon, TrashIcon } from '../../components/Icons.jsx';

export default function CommentsPage() {
  const { toast } = useToast();
  const [comments, setComments] = useState([]);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (q) sp.set('q', q);
      sp.set('page', String(page));
      const data = await api.get(`/api/admin/comments?${sp.toString()}`);
      setComments(data.comments);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [q, page]);

  useEffect(() => {
    load();
  }, [load]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.del(`/api/admin/comments/${deleteTarget.id}`);
      toast('Comment removed', 'success');
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="page-head" style={{ padding: '0 0 16px' }}>
        <h1>Comment moderation</h1>
        <p className="sub">Review all comments and remove inappropriate content.</p>
      </div>

      <div className="filter-bar">
        <div className="searchbar" style={{ flex: 1, minWidth: 220, maxWidth: 420 }}>
          <SearchIcon />
          <input placeholder="Search comments…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
        <span className="small muted">{total} comment{total !== 1 ? 's' : ''}</span>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Comment</th>
              <th>Author</th>
              <th>Article</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5}><div className="skeleton" style={{ height: 180 }} /></td></tr>}
            {!loading && comments.length === 0 && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 32 }}>No comments found.</td></tr>}
            {!loading && comments.map((c) => (
              <tr key={c.id}>
                <td style={{ maxWidth: 360 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.content}</div>
                  {c.edited_at && <span className="small muted">(edited)</span>}
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar user={{ name: c.user_name, avatar: c.user_avatar }} size="sm" />
                    <div>
                      <div style={{ fontWeight: 600 }}>{c.user_name}</div>
                      <div className="small muted">{c.user_email}</div>
                    </div>
                  </div>
                </td>
                <td><Link to={`/article/${c.article_id}`} style={{ color: 'var(--primary)' }}>{c.article_title}</Link></td>
                <td className="small muted">{formatDateTime(c.created_at)}</td>
                <td>
                  <button className="btn btn-danger-outline btn-sm" onClick={() => setDeleteTarget(c)}>
                    <TrashIcon /> Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      <ConfirmationModal
        open={!!deleteTarget}
        title="Remove this comment?"
        message="Are you sure you want to permanently remove this comment? This cannot be undone."
        confirmLabel="Remove comment"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        busy={busy}
      />
    </div>
  );
}
