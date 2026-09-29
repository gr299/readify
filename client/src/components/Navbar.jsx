import { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { Avatar } from './Avatar.jsx';
import { Logo } from './Logo.jsx';
import { MenuIcon, PlusIcon, UserIcon, FileTextIcon, LogOutIcon, ShieldIcon, BookIcon, SunIcon, MoonIcon, SettingsIcon } from './Icons.jsx';

export function Navbar() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const onLogin = pathname === '/login';
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    setMobileOpen(false);
    try {
      await logout();
      toast('Signed out', 'success');
      navigate('/');
    } catch {
      toast('Could not sign out', 'error');
    }
  };

  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <button
          type="button"
          className="burger"
          aria-label="Menu"
          aria-expanded={mobileOpen}
          aria-controls="site-nav"
          onClick={() => setMobileOpen((v) => !v)}
        >
          <MenuIcon style={{ fontSize: '1.2rem' }} />
        </button>
        <Logo to="/" />

        <nav id="site-nav" className={`topbar-nav ${mobileOpen ? 'open' : ''}`} onClick={() => setMobileOpen(false)}>
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/discover">Discover</NavLink>
          {user && <NavLink to="/dashboard">My Dashboard</NavLink>}
          {user && user.role === 'admin' && <NavLink to="/admin">Admin Portal</NavLink>}

          {user ? (
            <>
              <div className="mobile-divider" />
              <Link to="/upload" className="mobile-only"><PlusIcon /> New Article</Link>
              <Link to="/profile" className="mobile-only"><UserIcon /> Profile</Link>
              <Link to="/settings" className="mobile-only"><SettingsIcon /> Settings</Link>
              <button type="button" className="mobile-only" onClick={handleLogout}>
                <LogOutIcon /> Sign out
              </button>
            </>
          ) : (
            <>
              <div className="mobile-divider" />
              <Link to="/login" className="mobile-only">Sign in</Link>
              <Link to="/register" className="mobile-only">Create account</Link>
            </>
          )}
        </nav>

        <div className="topbar-actions">
          <button
            type="button"
            className="theme-toggle"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          {user ? (
            <>
              <Link to="/upload" className="btn btn-primary btn-sm">
                <PlusIcon /> <span className="new-article-label">New Article</span>
              </Link>
              <div className="user-menu">
                <button
                  type="button"
                  className="user-chip btn btn-ghost"
                  onClick={() => setMenuOpen((v) => !v)}
                >
                  <Avatar user={user} size="sm" />
                  <span className="small">{user.name.split(' ')[0]}</span>
                </button>
                {menuOpen && (
                  <div className="user-menu-pop" onMouseLeave={() => setMenuOpen(false)}>
                    <Link to="/dashboard" onClick={() => setMenuOpen(false)}>
                      <FileTextIcon /> My Dashboard
                    </Link>
                    <Link to="/upload" onClick={() => setMenuOpen(false)}>
                      <PlusIcon /> Upload Article
                    </Link>
                    <Link to="/saved" onClick={() => setMenuOpen(false)}>
                      <BookIcon /> Saved Articles
                    </Link>
                    {user.role === 'admin' && (
                      <Link to="/admin" onClick={() => setMenuOpen(false)}>
                        <ShieldIcon /> Admin Portal
                      </Link>
                    )}
                    <Link to="/settings" onClick={() => setMenuOpen(false)}>
                      <SettingsIcon /> Settings
                    </Link>
                    <div className="divider" />
                    <Link to="/profile" onClick={() => setMenuOpen(false)}>
                      <UserIcon /> My Profile
                    </Link>
                    <Link to={`/authors/${user.id}`} onClick={() => setMenuOpen(false)}>
                      <UserIcon /> Public Profile
                    </Link>
                    <button type="button" onClick={handleLogout}>
                      <LogOutIcon /> Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className={`btn btn-ghost btn-sm${onLogin ? ' nav-current' : ''}`}
                aria-current={onLogin ? 'page' : undefined}
              >
                Sign in
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">Get started</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
