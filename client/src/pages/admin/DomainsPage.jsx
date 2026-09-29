import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api, formatDateTime } from '../../api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { ConfirmationModal } from '../../components/ConfirmationModal.jsx';
import { PlusIcon, GlobeIcon, TrashIcon } from '../../components/Icons.jsx';

export default function DomainsPage() {
  const { domains, setDomains } = useOutletContext();
  const { toast } = useToast();
  const [host, setHost] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const reload = async () => {
    try {
      const d = await api.get('/api/admin/domains');
      setDomains(d.domains);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  useEffect(() => {
    if (!domains || domains.length === 0) reload();
  }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!host.trim()) return;
    setBusy(true);
    try {
      await api.post('/api/admin/domains', { host, label });
      setHost('');
      setLabel('');
      toast('Domain added', 'success');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (d) => {
    try {
      await api.patch(`/api/admin/domains/${d.id}`, { is_active: d.is_active ? false : true });
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const updateLabel = async (d) => {
    const newLabel = window.prompt('Domain label:', d.label || '');
    if (newLabel === null) return;
    try {
      await api.patch(`/api/admin/domains/${d.id}`, { label: newLabel.trim() });
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.del(`/api/admin/domains/${deleteTarget.id}`);
      toast('Domain removed', 'success');
      setDeleteTarget(null);
      reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="page-head" style={{ padding: '0 0 16px' }}>
        <h1>Admin Portal domains</h1>
        <p className="sub">
          Only requests arriving from authorized domains (or the current development host) can reach the Admin Portal API.
        </p>
      </div>

      <div className="form-card">
        <h3 style={{ fontSize: '1.05rem', marginBottom: 12 }}><PlusIcon style={{ verticalAlign: '-3px' }} /> Add an authorized domain</h3>
        <form onSubmit={add} className="row" style={{ gap: 10 }}>
          <div className="field" style={{ flex: 2, marginBottom: 0 }}>
            <input placeholder="admin.readify-domain-1.com" value={host} onChange={(e) => setHost(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <input placeholder="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <button className="btn btn-primary" disabled={busy || !host.trim()}>
            <PlusIcon /> Add
          </button>
        </form>
        <p className="hint" style={{ marginTop: 8 }}>
          Enter the domain that will host the Admin Portal, e.g. <strong>admin.readify-domain-2.com</strong>.
        </p>
      </div>

      <div className="table-wrap" style={{ marginTop: 20 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Domain</th>
              <th>Label</th>
              <th>Status</th>
              <th>Added</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(!domains || domains.length === 0) && (
              <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 32 }}>No domains configured.</td></tr>
            )}
            {domains.map((d) => (
              <tr key={d.id}>
                <td>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                    <GlobeIcon /> {d.host}
                  </span>
                </td>
                <td className="small">{d.label || '—'}</td>
                <td>
                  <span className={`domain-dot ${d.is_active ? 'on' : 'off'}`} />
                  {d.is_active ? 'Active' : 'Inactive'}
                </td>
                <td className="small muted">{formatDateTime(d.created_at)}</td>
                <td>
                  <div className="table-actions">
                    <button className={`btn ${d.is_active ? 'btn-outline' : 'btn-success'} btn-sm`} onClick={() => toggle(d)}>
                      {d.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button className="btn btn-outline btn-sm" onClick={() => updateLabel(d)}>Rename</button>
                    <button className="btn btn-danger-outline btn-sm" onClick={() => setDeleteTarget(d)}>
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
        open={!!deleteTarget}
        title="Remove this domain?"
        message={`Remove "${deleteTarget?.host}" from the authorized Admin Portal domains? Requests from this domain will no longer be able to access the Admin Portal.`}
        confirmLabel="Remove domain"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        busy={busy}
      />
    </div>
  );
}
