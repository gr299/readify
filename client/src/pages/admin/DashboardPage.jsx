import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, timeAgo } from '../../api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Avatar } from '../../components/Avatar.jsx';
import { StatusBadge } from '../../components/Badges.jsx';
import {
  FileTextIcon, UsersIcon, MessageSquareIcon, HeartIcon, EyeIcon, BookmarkIcon, GlobeIcon,
} from '../../components/Icons.jsx';

export default function DashboardPage() {
  const { toast } = useToast();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/api/admin/dashboard')
      .then(setData)
      .catch((e) => toast(e.message, 'error'));
  }, []);

  if (!data) {
    return <div className="stack">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 90 }} />)}</div>;
  }

  const s = data.stats;

  return (
    <div>
      <div className="page-head" style={{ padding: '0 0 20px' }}>
        <h1>Dashboard</h1>
        <p className="sub">Overview of everything happening on Readify.</p>
      </div>

      <div className="stat-grid">
        <div className="stat-card accent"><div className="num">{s.total_articles}</div><div className="label">Total articles</div></div>
        <div className="stat-card green"><div className="num">{s.published}</div><div className="label">Published</div></div>
        <div className="stat-card amber"><div className="num">{s.pending}</div><div className="label">Pending</div></div>
        <div className="stat-card"><div className="num">{s.drafts}</div><div className="label">Drafts</div></div>
        <div className="stat-card red"><div className="num">{s.rejected}</div><div className="label">Rejected</div></div>
        <div className="stat-card"><div className="num">{s.archived}</div><div className="label">Archived</div></div>
        <div className="stat-card"><div className="num">{s.total_users}</div><div className="label">Users</div></div>
        <div className="stat-card"><div className="num">{s.total_comments}</div><div className="label">Comments</div></div>
        <div className="stat-card"><div className="num">{s.total_reactions}</div><div className="label">Reactions</div></div>
        <div className="stat-card"><div className="num">{s.total_views}</div><div className="label">Views</div></div>
        <div className="stat-card"><div className="num">{s.total_bookmarks}</div><div className="label">Bookmarks</div></div>
        <div className="stat-card"><div className="num">{s.total_domains}</div><div className="label">Domains</div></div>
      </div>

      <div className="two-col" style={{ marginTop: 28 }}>
        <div className="form-card">
          <h3 style={{ fontSize: '1.1rem', marginBottom: 14 }}><FileTextIcon style={{ verticalAlign: '-3px' }} /> Recent articles</h3>
          <div className="stack" style={{ gap: 10 }}>
            {data.recent_articles.slice(0, 6).map((a) => (
              <div key={a.id} className="row" style={{ justifyContent: 'space-between' }}>
                <div style={{ minWidth: 0 }}>
                  <Link to={`/article/${a.id}`} style={{ fontWeight: 600, fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                    {a.title}
                  </Link>
                  <span className="small muted">{timeAgo(a.created_at)}</span>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        </div>

        <div className="form-card">
          <h3 style={{ fontSize: '1.1rem', marginBottom: 14 }}><UsersIcon style={{ verticalAlign: '-3px' }} /> Recent users</h3>
          <div className="stack" style={{ gap: 10 }}>
            {data.recent_users.map((u) => (
              <div key={u.id} className="row">
                <Avatar user={u} size="sm" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{u.name}</div>
                  <div className="small muted">{u.email} · {timeAgo(u.created_at)}</div>
                </div>
                <span style={{ marginLeft: 'auto' }} className={`badge badge-${u.role}`}>{u.role}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="form-card" style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: 14 }}><MessageSquareIcon style={{ verticalAlign: '-3px' }} /> Recent comments</h3>
        {data.recent_comments.length === 0 ? (
          <p className="muted">No comments yet.</p>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            {data.recent_comments.map((c) => (
              <div key={c.id} className="row" style={{ justifyContent: 'space-between' }}>
                <div style={{ minWidth: 0 }}>
                  <span className="small" style={{ fontWeight: 600 }}>{c.user_name}</span>
                  <span className="small muted"> on </span>
                  <Link to={`/article/${c.article_id}`} className="small" style={{ color: 'var(--primary)' }}>{c.article_title}</Link>
                  <div className="small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 480 }}>{c.content}</div>
                </div>
                <span className="small muted">{timeAgo(c.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
