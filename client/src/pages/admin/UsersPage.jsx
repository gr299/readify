import { useEffect, useState, useCallback } from 'react';
import { api, formatDateTime } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Avatar } from '../../components/Avatar.jsx';
import { RoleBadge } from '../../components/Badges.jsx';
import { ConfirmationModal } from '../../components/ConfirmationModal.jsx';
import { Pagination } from '../../components/Pagination.jsx';
import { SearchIcon, EditIcon, TrashIcon } from '../../components/Icons.jsx';

export default function UsersPage() {
  const { toast } = useToast();
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (q) sp.set('q', q);
      if (role !== 'all') sp.set('role', role);
      sp.set('page', String(page));
      const data = await api.get(`/api/admin/users?${sp.toString()}`);
      setUsers(data.users);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [q, role, page]);

  useEffect(() => {
    load();
  }, [load]);

  const updateUser = async (u, patch) => {
    try {
      const data = await api.patch(`/api/admin/users/${u.id}`, patch);
      setUsers((us) => us.map((x) => (x.id === u.id ? data.user : x)));
      toast('User updated', 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const name = editName.trim();
    if (name.length < 2 || name.length > 60) return toast('Name must be between 2 and 60 characters', 'error');
    setBusy(true);
    try {
      const data = await api.patch(`/api/admin/users/${editing.id}`, { name, bio: editBio.trim() || null });
      setUsers((us) => us.map((x) => (x.id === editing.id ? data.user : x)));
      toast('Profile updated', 'success');
      setEditing(null);
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
      await api.del(`/api/admin/users/${deleteTarget.id}`);
      toast('User deleted', 'success');
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
        <h1>User management</h1>
        <p className="sub">View accounts, change roles, and manage access.</p>
      </div>

      <div className="filter-bar">
        <div className="searchbar" style={{ flex: 1, minWidth: 220, maxWidth: 420 }}>
          <SearchIcon />
          <input placeholder="Search by name or email…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
        <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--surface)' }}>
          <option value="all">All roles</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>
        <span className="small muted">{total} user{total !== 1 ? 's' : ''}</span>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Articles</th>
              <th>Comments</th>
              <th>Reactions</th>
              <th>Joined</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8}><div className="skeleton" style={{ height: 180 }} /></td></tr>}
            {!loading && users.length === 0 && <tr><td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 32 }}>No users found.</td></tr>}
            {!loading && users.map((u) => {
              const isSelf = me?.id === u.id;
              return (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar user={u} size="sm" />
                      <div>
                        <div style={{ fontWeight: 600 }}>{u.name} {isSelf && <span className="small muted">(you)</span>}</div>
                        <div className="small muted">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><RoleBadge role={u.role} /></td>
                  <td>{u.article_count}</td>
                  <td>{u.comment_count}</td>
                  <td>{u.reaction_count}</td>
                  <td className="small muted">{formatDateTime(u.created_at)}</td>
                  <td>
                    <span className={`domain-dot ${u.active ? 'on' : 'off'}`} />
                    {u.active ? 'Active' : 'Disabled'}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-ghost btn-sm" title="Edit profile" onClick={() => { setEditing(u); setEditName(u.name); setEditBio(u.bio || ''); }}>
                        <EditIcon />
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        disabled={isSelf}
                        onClick={() => updateUser(u, { role: u.role === 'admin' ? 'user' : 'admin' })}
                      >
                        {u.role === 'admin' ? 'Demote to user' : 'Promote to admin'}
                      </button>
                      <button
                        className={`btn ${u.active ? 'btn-danger-outline' : 'btn-success'} btn-sm`}
                        disabled={isSelf}
                        onClick={() => updateUser(u, { active: u.active ? false : true })}
                      >
                        {u.active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        className="btn btn-danger-outline btn-sm"
                        title="Delete account"
                        disabled={isSelf}
                        onClick={() => setDeleteTarget(u)}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      <ConfirmationModal
        open={!!editing}
        title={`Edit ${editing?.name}`}
        message="Update this user's display name and bio."
        confirmLabel="Save"
        onConfirm={saveEdit}
        onCancel={() => setEditing(null)}
        busy={busy}
      >
        <div className="field" style={{ marginTop: 14 }}>
          <label>Display name</label>
          <input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={60} autoFocus />
        </div>
        <div className="field">
          <label>Bio</label>
          <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} rows={3} maxLength={500} />
        </div>
      </ConfirmationModal>

      <ConfirmationModal
        open={!!deleteTarget}
        title="Delete this account?"
        message={`Delete ${deleteTarget?.name}'s account? All of their articles, comments, and reactions will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete account"
        tone="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        busy={busy}
      />
    </div>
  );
}
