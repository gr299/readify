import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { SaveIcon } from '../../components/Icons.jsx';

const FIELDS = [
  { key: 'site_name', label: 'Site name', type: 'text' },
  { key: 'site_tagline', label: 'Site tagline', type: 'text' },
  { key: 'allow_registration', label: 'Allow new user registration', type: 'select', options: [['1', 'Enabled'], ['0', 'Disabled']] },
  { key: 'articles_per_page', label: 'Articles per page', type: 'select', options: [['6', '6'], ['12', '12'], ['18', '18'], ['24', '24']] },
  { key: 'require_review_before_publish', label: 'Require admin review before publishing', type: 'select', options: [['1', 'Yes'], ['0', 'No']] },
];

export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/api/admin/settings').then((d) => setSettings(d.settings)).catch((e) => toast(e.message, 'error'));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const data = await api.put('/api/admin/settings', { settings });
      setSettings(data.settings);
      toast('Settings saved', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <div className="skeleton" style={{ height: 400 }} />;

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="page-head" style={{ padding: '0 0 16px' }}>
        <h1>System settings</h1>
        <p className="sub">Manage global Readify configuration.</p>
      </div>

      <div className="form-card">
        {FIELDS.map((f) => (
          <div className="field" key={f.key}>
            <label htmlFor={`s-${f.key}`}>{f.label}</label>
            {f.type === 'text' ? (
              <input id={`s-${f.key}`} value={settings[f.key] || ''} onChange={(e) => setSettings((s) => ({ ...s, [f.key]: e.target.value }))} />
            ) : (
              <select id={`s-${f.key}`} value={String(settings[f.key] ?? '')} onChange={(e) => setSettings((s) => ({ ...s, [f.key]: e.target.value }))}>
                {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            )}
          </div>
        ))}
        <div className="form-actions">
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            <SaveIcon /> {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
