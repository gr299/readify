import { useEffect, useState } from 'react';
import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { AuthorizedDomainGate } from '../../components/RouteGuards.jsx';
import { Avatar } from '../../components/Avatar.jsx';
import { Logo } from '../../components/Logo.jsx';
import {
  DashboardIcon, FileTextIcon, UsersIcon, MessageSquareIcon, HeartIcon,
  SettingsIcon, GlobeIcon, LogOutIcon, BookIcon, MenuIcon, XIcon, SunIcon, MoonIcon,
  InboxIcon, CheckIcon, XIcon as CrossIcon, ArchiveIcon, LayersIcon, TagIcon, StarIcon,
  ChartIcon, ActivityIcon,
} from '../../components/Icons.jsx';

const NAV = [
  { to: '/admin', end: true, label: 'Dashboard', Icon: DashboardIcon },
  {
    label: 'Articles',
    items: [
      { to: '/admin/articles', end: true, label: 'All articles', Icon: FileTextIcon },
      { to: '/admin/articles?status=pending', label: 'Pending', Icon: InboxIcon },
      { to: '/admin/articles?status=published', label: 'Published', Icon: CheckIcon },
      { to: '/admin/articles?status=draft', label: 'Drafts', Icon: FileTextIcon },
      { to: '/admin/articles?status=rejected', label: 'Rejected', Icon: CrossIcon },
      { to: '/admin/articles?status=archived', label: 'Archived', Icon: ArchiveIcon },
    ],
  },
  { to: '/admin/users', label: 'Users', Icon: UsersIcon },
  { to: '/admin/comments', label: 'Comments', Icon: MessageSquareIcon },
  { to: '/admin/reactions', label: 'Reactions', Icon: HeartIcon },
  { to: '/admin/categories', label: 'Categories', Icon: LayersIcon },
  { to: '/admin/tags', label: 'Tags', Icon: TagIcon },
  { to: '/admin/featured', label: 'Featured Articles', Icon: StarIcon },
  { to: '/admin/analytics', label: 'Analytics', Icon: ChartIcon },
  { to: '/admin/activity', label: 'Activity Log', Icon: ActivityIcon },
  { to: '/admin/settings', label: 'Settings', Icon: SettingsIcon },
  { to: '/admin/domains', label: 'Domains', Icon: GlobeIcon },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [domains, setDomains] = useState([]);
  const [domainsLoaded, setDomainsLoaded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    api.get('/api/admin/domains')
      .then((d) => {
        setDomains(d.domains);
        setDomainsLoaded(true);
      })
      .catch(() => {
        setDomainsLoaded(true); // don't block forever on error
      });
  }, []);

  const handleLogout = async () => {
    await logout();
    toast('Signed out', 'success');
    navigate('/');
  };

  return (
    <AuthorizedDomainGate domains={domains} domainsLoaded={domainsLoaded}>
      <div className="admin-layout">
        <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <Logo to="/" />
          <nav className="admin-nav">
            <div className="nav-label">Admin Portal</div>
            {NAV.map((item) => {
              if (item.items) {
                return (
                  <div key={item.label} className="admin-nav-group">
                    <div className="nav-label">{item.label}</div>
                    {item.items.map(({ to, end, label, Icon }) => (
                      <NavLink key={to} to={to} end={end} onClick={() => setSidebarOpen(false)}>
                        <Icon /> {label}
                      </NavLink>
                    ))}
                  </div>
                );
              }
              return (
                <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setSidebarOpen(false)}>
                  <item.Icon /> {item.label}
                </NavLink>
              );
            })}
            <div className="nav-label">Site</div>
            <NavLink to="/" onClick={() => setSidebarOpen(false)}><BookIcon /> View site</NavLink>
          </nav>
          <div className="admin-sidebar-foot">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar user={user} size="sm" />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: '#e4e5ea', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
                <div style={{ fontSize: '0.74rem' }}>Administrator</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              style={{ marginTop: 12, width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', color: '#d7d8de', border: 'none', cursor: 'pointer', fontSize: '0.86rem' }}
            >
              <LogOutIcon /> Sign out
            </button>
          </div>
        </aside>

        <div className="admin-main">
          <div className="admin-topbar">
            <button className="burger admin-mobile-nav" onClick={() => setSidebarOpen((v) => !v)} aria-label="Toggle navigation">
              {sidebarOpen ? <XIcon /> : <MenuIcon />}
            </button>
            <span className="page-title">Admin Portal</span>
            <div className="spacer" />
            <button
              type="button"
              className="theme-toggle"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={toggleTheme}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            <Link to="/" className="btn btn-ghost btn-sm">View site</Link>
          </div>
          <div className="admin-content" key={location.pathname}>
            <Outlet context={{ domains, setDomains }} />
          </div>
        </div>
      </div>
    </AuthorizedDomainGate>
  );
}
