import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ShieldIcon } from './Icons.jsx';

function Loading() {
  return (
    <div className="container" style={{ padding: '80px 20px', textAlign: 'center' }}>
      <div className="skeleton" style={{ height: 30, width: 180, margin: '0 auto 16px' }} />
      <div className="skeleton" style={{ height: 16, width: 320, margin: '0 auto' }} />
    </div>
  );
}

export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}

export function RequireGuest({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (user) return <Navigate to={location.state?.from || '/'} replace />;
  return children;
}

const DEV_HOST_SUFFIXES = ['monkeycode-ai.live', 'monkeycode-ai.online'];

export function RequireAdmin({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" state={{ from: '/admin' }} replace />;
  if (user.role !== 'admin') {
    return (
      <div className="container" style={{ padding: '80px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}><ShieldIcon /></div>
        <h1 style={{ fontSize: '1.8rem' }}>Admin access required</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          Your account does not have permission to access the Admin Portal.
        </p>
      </div>
    );
  }
  return children;
}

export function isDevHost() {
  const host = window.location.hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || DEV_HOST_SUFFIXES.some((s) => host.endsWith(s));
}

export function AuthorizedDomainGate({ children, domains, domainsLoaded }) {
  if (isDevHost()) return children;
  // Don't block before we've fetched the domains list from the server
  if (!domainsLoaded) return children;
  const host = window.location.hostname.toLowerCase().replace(/^www\./, '');
  // If no domains are configured yet, let the admin through so they can configure them
  if (domains.length === 0) return children;
  const ok = domains.some((d) => d.host.toLowerCase() === host && d.is_active);
  if (!ok) {
    return (
      <div className="container" style={{ padding: '80px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}><ShieldIcon /></div>
        <h1 style={{ fontSize: '1.8rem' }}>Unauthorized domain</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          The domain <strong>{host}</strong> is not authorized to access the Admin Portal.
        </p>
      </div>
    );
  }
  return children;
}
