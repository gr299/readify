import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { ApiError } from '../api.js';
import { MailIcon, LockIcon } from '../components/Icons.jsx';
import { PasswordField } from '../components/PasswordField.jsx';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateEmail = (value) => {
  if (!value.trim()) return 'Enter your email address.';
  if (!EMAIL_RE.test(value.trim())) return 'Enter a valid email address.';
  return '';
};

const validatePassword = (value) => (value ? '' : 'Enter your password.');

function messageFor(err) {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Invalid email or password';
    if (err.status === 429) return 'Too many attempts. Please wait a moment and try again.';
    if (err.status >= 500) return 'Something went wrong on our side. Please try again.';
    return err.message || 'Sign in failed';
  }
  return "We couldn't reach the server. Check your connection and try again.";
}

export default function LoginPage() {
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const onEmailChange = (e) => {
    setEmail(e.target.value);
    if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: '' }));
    if (formError) setFormError('');
  };

  const onPasswordChange = (e) => {
    setPassword(e.target.value);
    if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: '' }));
    if (formError) setFormError('');
  };

  const validateAll = () => {
    const next = { email: validateEmail(email), password: validatePassword(password) };
    setFieldErrors(next);
    return !next.email && !next.password;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setFormError('');
    if (!validateAll()) return;
    setBusy(true);
    try {
      const user = await login(email.trim(), password);
      toast(`Welcome back, ${user.name.split(' ')[0]}!`, 'success');
      navigate(location.state?.from || (user.role === 'admin' ? '/admin' : '/'));
    } catch (err) {
      setFormError(messageFor(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="form-card auth-card">
        <div className="auth-header">
          <span className="eyebrow">Welcome back</span>
          <h1>Sign in to Readify</h1>
          <p className="muted auth-sub">Continue reading and writing.</p>
        </div>

        {formError ? <div className="alert alert-error" role="alert">{formError}</div> : null}

        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <div className="icon-input">
              <MailIcon />
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={onEmailChange}
                onBlur={() => setFieldErrors((f) => ({ ...f, email: validateEmail(email) }))}
                placeholder="you@example.com"
                autoComplete="email"
                aria-invalid={fieldErrors.email ? 'true' : undefined}
                aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
              />
            </div>
            {fieldErrors.email ? <span className="error" id="login-email-error" role="alert">{fieldErrors.email}</span> : null}
          </div>

          <PasswordField
            id="login-password"
            label="Password"
            labelAction={<Link to="/forgot-password">Forgot password?</Link>}
            leadingIcon={LockIcon}
            value={password}
            onChange={onPasswordChange}
            onBlur={() => setFieldErrors((f) => ({ ...f, password: validatePassword(password) }))}
            visible={showPassword}
            onToggle={() => setShowPassword((v) => !v)}
            placeholder="Your password"
            autoComplete="current-password"
            error={fieldErrors.password}
            toggleLabel="password"
          />

          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy} aria-busy={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="divider" />
        <p className="small muted auth-foot">
          New to Readify? <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>Create an account</Link>
        </p>
      </div>
    </div>
  );
}
