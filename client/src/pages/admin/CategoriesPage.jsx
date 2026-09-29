import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { ConfirmationModal } from '../../components/ConfirmationModal.jsx';
import { PlusIcon, EditIcon, TrashIcon } from '../../components/Icons.jsx';

export default function CategoriesPage() {
  const { toast } = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [reassignTo, setReassignTo] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/admin/categories');
      setCategories(data.categories);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    const name = newName.trim();
    if (name.length < 2) return toast('Category name must be at least 2 characters', 'error');
    setBusy(true);
    try {
      await api.post('/api/admin/categories', { name });
      toast('Category created', 'success');
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
    const name = editName.trim();
    if (name.length < 2) return toast('Category name must be at least 2 characters', 'error');
    setBusy(true);
    try {
      await api.patch(`/api/admin/categories/${editing.id}`, { name });
      toast('Category updated', 'success');
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
      const body = reassignTo ? { reassign_to: Number(reassignTo) } : undefined;
      await api.del(`/api/admin/categories/${deleteTarget.id}`, body);
      toast('Category deleted', 'success');
      setDeleteTarget(null);
      setReassignTo('');
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const others = categories.filter((c) => c.id !== deleteTarget?.id);

  return (
    <div>
      <div className="page-head" style={{ padding: '0 0 16px' }}>
        <h1>Categories</h1>
        <p className="sub">Organize articles into a clean taxonomy.</p>
      </div>

      <div className="form-card" style={{ marginBottom: 24, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category name"
          style={{ flex: 1, minWidth: 220 }}
          onKeyDown={(e) => e.key === 'Enter' && create()}
        />
        <button className="btn btn-primary" onClick={create} disabled={busy || !newName.trim()}>
          <PlusIcon /> Add category
        </button>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Category</th>
              <th>Slug</th>
              <th>Articles</th>
              <th>Published</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5}><div className="skeleton" style={{ height: 160 }} /></td></tr>}
            {!loading && categories.length === 0 && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 32 }}>No categories yet.</td></tr>}
            {!loading && categories.map((c) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.name}</td>
                <td className="small muted">{c.slug}</td>
                <td>{c.article_count}</td>
                <td>{c.published_count}</td>
                <td>
                  <div className="table-actions">
                    <button
                      className="btn btn-ghost btn-sm"
                      title="Rename"
                      onClick={() => { setEditing(c); setEditName(c.name); }}
                    >
                      <EditIcon />
                    </button>
                    <button
                      className="btn btn-danger-outline btn-sm"
                      title="Delete"
                      onClick={() => { setDeleteTarget(c); setReassignTo(''); }}
                    >
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
        title="Rename category"
        message={`Rename "${editing?.name}" to a new name. Existing articles keep this category.`}
        confirmLabel="Save"
        onConfirm={saveEdit}
        onCancel={() => setEditing(null)}
        busy={busy}
      >
        <div className="field" style={{ marginTop: 14 }}>
          <label>Category name</label>
          <input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
        </div>
      </ConfirmationModal>

      <ConfirmationModal
        open={!!deleteTarget}
        title="Delete category?"
        message={
          deleteTarget?.article_count > 0
            ? `"${deleteTarget.name}" is used by ${deleteTarget.article_count} article(s). Select a replacement category to move them to before deleting.`
            : `Delete "${deleteTarget?.name}"? It is not used by any articles.`
        }
        confirmLabel="Delete category"
        tone="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        busy={busy}
      >
        {deleteTarget?.article_count > 0 && (
          <div className="field" style={{ marginTop: 14 }}>
            <label>Move its articles to</label>
            <select value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
              <option value="">Select replacement…</option>
              {others.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
      </ConfirmationModal>
    </div>
  );
}
