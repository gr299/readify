import { Link } from 'react-router-dom';
import { Logo } from './Logo.jsx';

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-inner">
          <div>
            <Logo to="/" size={26} />
            <p>Read, write, and share great stories. A modern platform for authors and readers.</p>
          </div>
          <div>
            <h4>Explore</h4>
            <Link to="/">Home</Link>
            <Link to="/discover">Discover</Link>
            <Link to="/discover?sort=most-viewed">Most viewed</Link>
            <Link to="/discover?sort=most-reacted">Most reacted</Link>
          </div>
          <div>
            <h4>Account</h4>
            <Link to="/login">Sign in</Link>
            <Link to="/register">Create account</Link>
            <Link to="/upload">Write an article</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Readify. All rights reserved.</span>
          <span>Read. Write. Share.</span>
        </div>
      </div>
    </footer>
  );
}
