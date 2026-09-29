import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { ConfirmationModal } from '../components/ConfirmationModal.jsx';
import { PasswordField } from '../components/PasswordField.jsx';
import { CheckIcon, LockIcon, TrashIcon, SunIcon, MoonIcon } from '../components/Icons.jsx';

const THEME_OPTIONS = [
  { key: 'light', label: 'Light', icon: SunIcon },
  { key: 'dark', label: 'Dark', icon: MoonIcon },
];

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const [emailForm, setEmailForm] = useState({ new_email: '', password: '' });
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState(null);
  const [emailErr, setEmailErr] = useState('');

  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwErr, setPwErr] = useState('');

  const [deactOpen, setDeactOpen] = useState(false);
  const [deactPw, setDeactPw] = useState('');
  const [deactBusy, setDeactBusy] = useState(false);
  const [deactErr, setDeactErr] = useState('');

  const [visible, setVisible] = useState({ email: false, current: false, next: false, confirm: false });

  const requestEmailChange = async (e) => {
    e.preventDefault();
    setEmailBusy(true);
    setEmailErr('');
    setEmailMsg(null);
    try {
      const data = await api.post('/api/settings/email', emailForm);
      setEmailMsg({ text: data.message, link: data.dev ? data.verification_link : null });
      setEmailForm((f) => ({ ...f, password: '' }));
      toast('Verification link sent', 'success');
    } catch (err) {
      setEmailErr(err.message);
    } finally {
      setEmailBusy(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm) {
      setPwErr('New passwords do not match');
      return;
    }
    setPwBusy(true);
    setPwErr('');
    try {
      await api.post('/api/settings/password', {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      });
      toast('Password updated', 'success');
      setPwForm({ current_password: '', new_password: '', confirm: '' });
    } catch (err) {
      setPwErr(err.message);
    } finally {
      setPwBusy(false);
    }
  };

  const openDeactivate = () => {
    setDeactErr('');
    setDeactPw('');
    setDeactOpen(true);
  };

  const deactivate = async () => {
    setDeactBusy(true);
    setDeactErr('');
    try {
      await api.del('/api/settings/account', { password: deactPw });
      toast('Account deactivated', 'success');
      await logout();
      navigate('/login');
    } catch (err) {
      setDeactErr(err.message);
      setDeactBusy(false);
    }
  };

  const toggleVisible = (key) => setVisible((v) => ({ ...v, [key]: !v[key] }));

  return (
    <div className="acct-page">
      <div className="page-head">
        <h1>Settings</h1>
        <p className="sub">Manage your account and preferences.</p>
      </div>

      <div className="settings-stack">
        <section className="settings-section" aria-labelledby="sec-appearance">
          <h2 id="sec-appearance">Appearance</h2>
          <p className="section-desc">Choose how Readify looks on your device.</p>
          <div className="seg" role="group" aria-label="Theme">
            {THEME_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = theme === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  className={active ? 'active' : ''}
                  aria-pressed={active}
                  onClick={() => setTheme(opt.key)}
                >
                  {active && <CheckIcon />}
                  <Icon />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="settings-section" aria-labelledby="sec-email">
          <h2 id="sec-email">Email</h2>
          <p className="section-desc">
            Current: <strong>{user?.email}</strong>
          </p>
          <form onSubmit={requestEmailChange}>
            <div className="field">
              <label htmlFor="settings-email-new">New email address</label>
              <input
                id="settings-email-new"
                type="email"
                placeholder="you@example.com"
                required
                value={emailForm.new_email}
                onChange={(e) => setEmailForm((f) => ({ ...f, new_email: e.target.value }))}
              />
            </div>
            <PasswordField
              id="settings-email-pw"
              label="Current password"
              toggleLabel="Current password for email change"
              placeholder="Enter your current password"
              value={emailForm.password}
              visible={visible.email}
              onChange={(e) => setEmailForm((f) => ({ ...f, password: e.target.value }))}
              onToggle={() => toggleVisible('email')}
            />
            {emailErr && <div className="alert alert-error">{emailErr}</div>}
            {emailMsg && (
              <div className="alert alert-success">
                {emailMsg.text}
                {emailMsg.link && (
                  <> <a href={emailMsg.link}>Open verification link (dev mode)</a></>
                )}
              </div>
            )}
            <div>
              <button id="email-submit" type="submit" className="btn btn-primary" disabled={emailBusy}>
                {emailBusy ? 'Sending…' : 'Send verification link'}
              </button>
            </div>
          </form>
        </section>

        <section className="settings-section" aria-labelledby="sec-password">
          <h2 id="sec-password">Password</h2>
          <p className="section-desc">
            <LockIcon /> Changing your password signs you out everywhere else.
          </p>
          <form onSubmit={changePassword}>
            <PasswordField
              id="settings-pw-current"
              label="Current password"
              placeholder="Enter your current password"
              value={pwForm.current_password}
              visible={visible.current}
              onChange={(e) => setPwForm((f) => ({ ...f, current_password: e.target.value }))}
              onToggle={() => toggleVisible('current')}
            />
            <PasswordField
              id="settings-pw-new"
              label="New password"
              placeholder="At least 8 characters"
              value={pwForm.new_password}
              visible={visible.next}
              onChange={(e) => setPwForm((f) => ({ ...f, new_password: e.target.value }))}
              onToggle={() => toggleVisible('next')}
              hint="At least 8 characters · at least one letter · one number"
            />
            <PasswordField
              id="settings-pw-confirm"
              label="Confirm new password"
              placeholder="Repeat the new password"
              value={pwForm.confirm}
              visible={visible.confirm}
              onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
              onToggle={() => toggleVisible('confirm')}
            />
            {pwErr && <div className="alert alert-error">{pwErr}</div>}
            <div>
              <button id="pw-submit" type="submit" className="btn btn-primary" disabled={pwBusy}>
                {pwBusy ? 'Updating…' : 'Change password'}
              </button>
            </div>
          </form>
        </section>

        <section className="settings-section card-danger" aria-labelledby="sec-danger">
          <h2 id="sec-danger">Danger Zone</h2>
          <p className="section-desc">
            Deactivating your account hides it from everyone and prevents sign-in. Your articles
            and comments stay. An administrator can re-activate it.
          </p>
          <button type="button" className="btn btn-danger" onClick={openDeactivate}>
            <TrashIcon /> Deactivate Account
          </button>
        </section>
      </div>

      <ConfirmationModal
        open={deactOpen}
        title="Deactivate your account?"
        message="Are you sure you want to deactivate your account? It will be hidden and you will not be able to sign in. Your articles and comments will remain available. Enter your current password to confirm."
        confirmLabel="Deactivate"
        busy={deactBusy}
        onConfirm={deactivate}
        onCancel={() => setDeactOpen(false)}
      >
        <div className="field">
          <label htmlFor="settings-deact-pw">Current password</label>
          <input
            id="settings-deact-pw"
            type="password"
            placeholder="Current password"
            value={deactPw}
            onChange={(e) => setDeactPw(e.target.value)}
          />
        </div>
        {deactErr && <div className="alert alert-error" role="alert">{deactErr}</div>}
      </ConfirmationModal>
    </div>
  );
}
