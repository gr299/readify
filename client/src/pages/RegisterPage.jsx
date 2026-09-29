import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function RegisterPage() {
  const { register } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      const user = await register(name, email, password);
      toast(`Welcome to Readify, ${user.name.split(' ')[0]}!`, 'success');
      navigate(user.role === 'admin' ? '/admin' : '/');
    } catch (err) {
      setError(err.message || 'Could not create account');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-narrow" style={{ paddingTop: 64, paddingBottom: 64 }}>
      <div className="form-card">
        <span className="eyebrow">Join Readify</span>
        <h1 style={{ fontSize: '1.8rem', margin: '6px 0 4px' }}>Create your account</h1>
        <p className="muted" style={{ marginBottom: 24 }}>Start writing and discover great stories.</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="reg-name">Full name</label>
            <input id="reg-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" required minLength={2} maxLength={80} autoComplete="name" />
          </div>
          <div className="field">
            <label htmlFor="reg-email">Email</label>
            <input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" />
          </div>
          <div className="two-col">
            <div className="field">
              <label htmlFor="reg-password">Password</label>
              <input id="reg-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8+ characters" required minLength={8} autoComplete="new-password" />
              <span className="hint">At least 8 characters with a letter and a number.</span>
            </div>
            <div className="field">
              <label htmlFor="reg-confirm">Confirm password</label>
              <input id="reg-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" required minLength={8} autoComplete="new-password" />
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy || !name || !email || !password || !confirm}>
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="small muted" style={{ textAlign: 'center', marginTop: 16 }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
