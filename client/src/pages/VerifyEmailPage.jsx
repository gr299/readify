import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [state, setState] = useState('loading');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const sent = useRef(false);

  useEffect(() => {
    if (!token) {
      setState('error');
      setError('This verification link is invalid or has expired. Request a new one from Settings.');
      return;
    }
    if (sent.current) return;
    sent.current = true;
    api
      .post('/api/settings/email/verify', { token })
      .then((data) => {
        setEmail(data.email);
        setState('success');
      })
      .catch((err) => {
        setError(err.message || 'This verification link is invalid or has expired. Request a new one from Settings.');
        setState('error');
      });
  }, [token]);

  return (
    <div className="container" style={{ paddingTop: 64, maxWidth: 480 }}>
      <div className="form-card" style={{ padding: '28px 30px', textAlign: 'center' }}>
        {state === 'loading' && <p>Verifying your email…</p>}
        {state === 'success' && (
          <>
            <h1 style={{ fontSize: '1.4rem', marginBottom: 8 }}>Email updated</h1>
            <p className="muted" style={{ marginBottom: 16 }}>
              Your email has been updated to <strong>{email}</strong>.
            </p>
            <Link to="/login" className="btn btn-primary">Sign in</Link>
          </>
        )}
        {state === 'error' && (
          <>
            <h1 style={{ fontSize: '1.4rem', marginBottom: 8 }}>Verification failed</h1>
            <p className="muted" style={{ marginBottom: 16 }}>{error}</p>
            <Link to="/settings" className="btn btn-primary">Go to Settings</Link>
          </>
        )}
      </div>
    </div>
  );
}
