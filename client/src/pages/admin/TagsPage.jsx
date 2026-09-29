import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { ConfirmationModal } from '../../components/ConfirmationModal.jsx';
import { SearchIcon, PlusIcon, EditIcon, TrashIcon } from '../../components/Icons.jsx';

export default function TagsPage() {
  const { toast } = useToast();
  const [tags, setTags] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get(`/api/admin/tags${q ? `?q=${encodeURIComponent(q)}` : ''}`);
      setTags(data.tags);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    const name = newName.trim().replace(/^#/, '');
    if (!name) return toast('A tag name is required', 'error');
    setBusy(true);
    try {
      await api.post('/api/admin/tags', { name });
      toast('Tag created', 'success');
      setNewName('');
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const name = editName.trim().replace(/^#/, '');
    if (!name) return toast('A tag name is required', 'error');
    setBusy(true);
    try {
      await api.patch(`/api/admin/tags/${editing.id}`, { name });
      toast('Tag updated', 'success');
      setEditing(null);
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
      await api.del(`/api/admin/tags/${deleteTarget.id}`);
      toast('Tag deleted', 'success');
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
        <h1>Tags</h1>
        <p className="sub">Create and manage the tags that articles use.</p>
      </div>

      <div className="filter-bar">
        <div className="searchbar" style={{ flex: 1, minWidth: 220, maxWidth: 380 }}>
          <SearchIcon />
          <input placeholder="Search tags…" value={q} onChange={(e) => { setQ(e.target.value); }} />
        </div>
        <span className="small muted">{tags.length} tag{tags.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="form-card" style={{ marginBottom: 24, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New tag name"
          style={{ flex: 1, minWidth: 200 }}
          onKeyDown={(e) => e.key === 'Enter' && create()}
        />
        <button className="btn btn-primary" onClick={create} disabled={busy || !newName.trim()}>
          <PlusIcon /> Add tag
        </button>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Tag</th>
              <th>Slug</th>
              <th>Articles</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4}><div className="skeleton" style={{ height: 160 }} /></td></tr>}
            {!loading && tags.length === 0 && <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 32 }}>No tags found.</td></tr>}
            {!loading && tags.map((t) => (
              <tr key={t.id}>
                <td style={{ fontWeight: 600 }}>#{t.name}</td>
                <td className="small muted">{t.slug}</td>
                <td>{t.article_count}</td>
                <td>
                  <div className="table-actions">
                    <button className="btn btn-ghost btn-sm" title="Rename" onClick={() => { setEditing(t); setEditName(t.name); }}>
                      <EditIcon />
                    </button>
                    <button className="btn btn-danger-outline btn-sm" title="Delete" onClick={() => setDeleteTarget(t)}>
                      <TrashIcon />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmationModal
        open={!!editing}
        title="Rename tag"
        message={`Rename "#${editing?.name}" to a new tag. Existing articles keep this tag.`}
        confirmLabel="Save"
        onConfirm={saveEdit}
        onCancel={() => setEditing(null)}
        busy={busy}
      >
        <div className="field" style={{ marginTop: 14 }}>
          <label>Tag name</label>
          <input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
        </div>
      </ConfirmationModal>

      <ConfirmationModal
        open={!!deleteTarget}
        title="Delete tag?"
        message={`Delete "#${deleteTarget?.name}"? It will be removed from all articles that use it.`}
        confirmLabel="Delete tag"
        tone="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        busy={busy}
      />
    </div>
  );
}
