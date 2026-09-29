import { Link } from 'react-router-dom';

export default function ForgotPasswordPage() {
  return (
    <div className="auth-page">
      <div className="form-card auth-card">
        <div className="auth-header">
          <span className="eyebrow">Account help</span>
          <h1>Reset your password</h1>
          <p className="muted auth-sub">
            Self-serve password reset is not available yet. Please contact support and we'll help you
            regain access to your account.
          </p>
        </div>
        <div className="alert alert-info">
          If you still have access, you can change your password from Settings.
        </div>
        <Link to="/login" className="btn btn-primary btn-lg btn-block">Back to sign in</Link>
      </div>
    </div>
  );
}
