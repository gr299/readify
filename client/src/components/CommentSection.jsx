import { useState, useEffect } from 'react';
import { api, formatDateTime, timeAgo } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useNavigate } from 'react-router-dom';
import { Avatar } from './Avatar.jsx';
import { CommentIcon, EditIcon, TrashIcon, SendIcon } from './Icons.jsx';
import { Pagination } from './Pagination.jsx';

export function CommentSection({ articleId, count }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [comments, setComments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const data = await api.get(`/api/articles/${articleId}/comments?page=${p}`);
      setComments(data.comments);
      setTotal(data.total);
      setTotalPages(data.total_pages);
      setPage(data.page);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
  }, [articleId]);

  const submit = async (e) => {
    e.preventDefault();
    if (!user) return navigate('/login');
    if (!draft.trim()) return;
    setSaving(true);
    try {
      const data = await api.post(`/api/articles/${articleId}/comments`, { content: draft });
      setComments((c) => [...c, data.comment]);
      setTotal((t) => t + 1);
      setDraft('');
    } catch (err) {
      toast(err.message || 'Could not add comment', 'error');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (c) => {
    setEditingId(c.id);
    setEditDraft(c.content);
  };

  const saveEdit = async (id) => {
    if (!editDraft.trim()) return;
    try {
      const data = await api.put(`/api/comments/${id}`, { content: editDraft });
      setComments((cs) => cs.map((c) => (c.id === id ? data.comment : c)));
      setEditingId(null);
      toast('Comment updated', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const remove = async (c) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await api.del(`/api/comments/${c.id}`);
      setComments((cs) => cs.filter((x) => x.id !== c.id));
      setTotal((t) => t - 1);
      toast('Comment deleted', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <section className="comments-section">
      <h2 className="eyebrow" style={{ fontSize: '0.8rem' }}>
        <CommentIcon /> Comments ({total})
      </h2>

      <form className="comment-form" onSubmit={submit} style={{ marginTop: '14px' }}>
        <textarea
          placeholder={user ? 'Share your thoughts…' : 'Sign in to leave a comment'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={!user}
        />
        <div className="row" style={{ marginTop: '10px' }}>
          <button type="submit" className="btn btn-primary btn-sm" disabled={!user || !draft.trim() || saving}>
            <SendIcon /> {saving ? 'Posting…' : 'Post comment'}
          </button>
          {!user && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/login')}>
              Sign in
            </button>
          )}
        </div>
      </form>

      <div className="comments-list">
        {loading && <div className="muted">Loading comments…</div>}
        {!loading && comments.length === 0 && <div className="muted">No comments yet — be the first to start the discussion.</div>}
        {comments.map((c) => (
          <div className="comment" key={c.id}>
            <Avatar user={c.author} />
            <div className="comment-body">
              <div className="comment-head">
                <span className="name">{c.author?.name}</span>
                <span className="time" title={formatDateTime(c.created_at)}>{timeAgo(c.created_at)}</span>
                {c.edited_at && <span className="comment-edited">(edited)</span>}
              </div>
              {editingId === c.id ? (
                <div style={{ marginTop: 8 }}>
                  <textarea
                    className="comment-edit"
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    rows={3}
                  />
                  <div className="comment-actions">
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => saveEdit(c.id)}>Save</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="comment-content">{c.content}</div>
              )}
              {editingId !== c.id && c.permissions?.can_edit && (
                <div className="comment-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(c)}>
                    <EditIcon /> Edit
                  </button>
                  {c.permissions?.can_delete && (
                    <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => remove(c)}>
                      <TrashIcon /> Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <Pagination page={page} totalPages={totalPages} onChange={load} />
    </section>
  );
}
