import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="container-narrow" style={{ paddingTop: 100, textAlign: 'center' }}>
      <h1 style={{ fontSize: '4rem', letterSpacing: '-0.03em' }}>404</h1>
      <p className="muted" style={{ marginTop: 8 }}>This page could not be found.</p>
      <div style={{ marginTop: 24 }}>
        <Link to="/" className="btn btn-primary">Back to Readify</Link>
      </div>
    </div>
  );
}
