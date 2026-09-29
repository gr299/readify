import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { ChartIcon, EyeIcon, HeartIcon, CommentIcon, UsersIcon, FileTextIcon, BookmarkIcon, StarIcon, ThumbsUpIcon, FireIcon, LightbulbIcon } from '../../components/Icons.jsx';

const TYPE_ICON = { like: ThumbsUpIcon, love: HeartIcon, fire: FireIcon, idea: LightbulbIcon };

function BarChart({ data, valueKey = 'c', labelKey = 'label', max = null, suffix = '' }) {
  const peak = max || Math.max(1, ...data.map((d) => Number(d[valueKey]) || 0));
  return (
    <div className="bar-chart">
      {data.map((d, i) => (
        <div className="bar-row" key={i}>
          <span className="bar-label">{d[labelKey]}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${((Number(d[valueKey]) || 0) / peak) * 100}%` }} />
          </div>
          <span className="bar-val">{d[valueKey]}{suffix}</span>
        </div>
      ))}
    </div>
  );
}

function RankTable({ rows, empty }) {
  if (!rows.length) return <p className="muted" style={{ fontSize: '0.9rem', padding: 8 }}>{empty}</p>;
  return (
    <div className="rank-list">
      {rows.map((a, i) => (
        <div className="rank-item" key={a.id}>
          <span className="rank-num">{i + 1}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <Link to={`/article/${a.id}`} style={{ fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</Link>
            <span className="small muted">{a.author || 'Unknown'} {a.featured ? '· ★ Featured' : ''}</span>
          </div>
          <span className="small muted">{a.views_count.toLocaleString()} views</span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const { toast } = useToast();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/api/admin/analytics').then(setData).catch((e) => toast(e.message, 'error'));
  }, []);

  if (!data) return <div className="skeleton" style={{ height: 420 }} />;

  const t = data.totals;
  const statusOrder = ['published', 'pending', 'draft', 'rejected', 'archived'];
  const statusRows = statusOrder
    .filter((s) => data.status_breakdown[s])
    .map((s) => ({ label: s[0].toUpperCase() + s.slice(1), c: data.status_breakdown[s] }));

  const statCards = [
    { label: 'Total views', value: t.total_views.toLocaleString(), Icon: EyeIcon, cls: 'accent' },
    { label: 'Users', value: t.total_users.toLocaleString(), Icon: UsersIcon },
    { label: 'Articles', value: t.total_articles.toLocaleString(), Icon: FileTextIcon, cls: 'green' },
    { label: 'Published', value: t.published.toLocaleString(), Icon: FileTextIcon },
    { label: 'Featured', value: t.featured.toLocaleString(), Icon: StarIcon, cls: 'amber' },
    { label: 'Comments', value: t.total_comments.toLocaleString(), Icon: CommentIcon },
    { label: 'Reactions', value: t.total_reactions.toLocaleString(), Icon: HeartIcon },
    { label: 'Bookmarks', value: t.total_bookmarks.toLocaleString(), Icon: BookmarkIcon },
    { label: 'New users (30d)', value: t.new_users_30d.toLocaleString(), Icon: UsersIcon, cls: 'green' },
    { label: 'New articles (30d)', value: t.new_articles_30d.toLocaleString(), Icon: FileTextIcon },
    { label: 'Views (30d)', value: t.new_views_30d.toLocaleString(), Icon: EyeIcon },
  ];

  return (
    <div>
      <div className="page-head" style={{ padding: '0 0 16px' }}>
        <h1>Analytics</h1>
        <p className="sub">Platform-wide engagement and publishing insights.</p>
      </div>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        {statCards.map(({ label, value, Icon, cls }) => (
          <div className={`stat-card ${cls || ''}`} key={label}>
            <div className="num"><Icon style={{ fontSize: '1.2rem', color: 'var(--primary)' }} /> {value}</div>
            <div className="label">{label}</div>
          </div>
        ))}
      </div>

      <div className="two-col" style={{ alignItems: 'start' }}>
        <div className="form-card">
          <h3 style={{ fontSize: '1.05rem', marginBottom: 14 }}><ChartIcon /> Published articles over time</h3>
          <BarChart data={data.published_over_time} labelKey="period" />
        </div>
        <div className="form-card">
          <h3 style={{ fontSize: '1.05rem', marginBottom: 14 }}><ChartIcon /> Views over the last 14 days</h3>
          {data.views_over_time.length === 0 ? (
            <p className="muted" style={{ fontSize: '0.9rem' }}>No views recorded yet.</p>
          ) : (
            <BarChart data={data.views_over_time} labelKey="day" />
          )}
        </div>
      </div>

      <div className="two-col" style={{ alignItems: 'start', marginTop: 24 }}>
        <div className="form-card">
          <h3 style={{ fontSize: '1.05rem', marginBottom: 14 }}>Most viewed</h3>
          <RankTable rows={data.most_viewed} empty="No published articles yet." />
        </div>
        <div className="form-card">
          <h3 style={{ fontSize: '1.05rem', marginBottom: 14 }}>Most reacted</h3>
          <RankTable rows={data.most_reacted} empty="No reactions yet." />
        </div>
      </div>

      <div className="two-col" style={{ alignItems: 'start', marginTop: 24 }}>
        <div className="form-card">
          <h3 style={{ fontSize: '1.05rem', marginBottom: 14 }}>Most commented</h3>
          <RankTable rows={data.most_commented} empty="No comments yet." />
        </div>
        <div className="form-card">
          <h3 style={{ fontSize: '1.05rem', marginBottom: 14 }}>Reactions by type</h3>
          {data.reactions_by_type.length === 0 ? (
            <p className="muted" style={{ fontSize: '0.9rem' }}>No reactions yet.</p>
          ) : (
            <BarChart data={data.reactions_by_type.map((r) => ({ label: r.type, c: r.c }))} />
          )}
        </div>
      </div>

      <div className="two-col" style={{ alignItems: 'start', marginTop: 24 }}>
        <div className="form-card">
          <h3 style={{ fontSize: '1.05rem', marginBottom: 14 }}>Article status breakdown</h3>
          <BarChart data={statusRows} />
        </div>
        <div className="form-card">
          <h3 style={{ fontSize: '1.05rem', marginBottom: 14 }}>Most active authors</h3>
          <div className="rank-list">
            {data.active_authors.map((u, i) => (
              <div className="rank-item" key={u.id}>
                <span className="rank-num">{i + 1}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Link to={`/authors/${u.id}`} style={{ fontWeight: 600 }}>{u.name}</Link>
                  <div className="small muted">{u.published_articles} published · {u.total_articles} total · {u.total_views.toLocaleString()} views</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
