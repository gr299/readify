import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api, formatDateTime } from '../../api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Avatar } from '../../components/Avatar.jsx';
import { StatusBadge } from '../../components/Badges.jsx';
import { Pagination } from '../../components/Pagination.jsx';
import { HeartIcon, ThumbsUpIcon, FireIcon, LightbulbIcon } from '../../components/Icons.jsx';

const TYPE_ICON = {
  like: ThumbsUpIcon,
  love: HeartIcon,
  fire: FireIcon,
  idea: LightbulbIcon,
};

export default function ReactionsPage() {
  const { toast } = useToast();
  const [reactions, setReactions] = useState([]);
  const [byType, setByType] = useState([]);
  const [articlesSummary, setArticlesSummary] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get(`/api/admin/reactions?page=${page}`);
      setReactions(data.reactions);
      setByType(data.by_type);
      setArticlesSummary(data.articles_summary || []);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="page-head" style={{ padding: '0 0 16px' }}>
        <h1>Reactions</h1>
        <p className="sub">Every reaction across the platform, aggregated and per-article.</p>
      </div>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        {byType.map((r) => {
          const Icon = TYPE_ICON[r.type] || HeartIcon;
          return (
            <div className="stat-card" key={r.type}>
              <div className="num"><Icon style={{ fontSize: '1.4rem', color: 'var(--primary)' }} /> {r.c}</div>
              <div className="label">{r.type} reactions</div>
            </div>
          );
        })}
        <div className="stat-card accent">
          <div className="num">{total}</div>
          <div className="label">Total reactions</div>
        </div>
      </div>

      <div className="table-wrap" style={{ marginBottom: 28 }}>
        <div style={{ padding: '14px 16px', fontWeight: 700, borderBottom: '1px solid var(--line)' }}>Most reacted articles</div>
        <table className="data">
          <thead>
            <tr>
              <th>Article</th>
              <th>Status</th>
              <th>Like</th>
              <th>Love</th>
              <th>Fire</th>
              <th>Idea</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {articlesSummary.length === 0 && (
              <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 28 }}>No reactions yet.</td></tr>
            )}
            {articlesSummary.map((a) => (
              <tr key={a.article_id}>
                <td><Link to={`/article/${a.article_id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>{a.article_title}</Link></td>
                <td><StatusBadge status={a.status} /></td>
                <td>{a.types?.like || 0}</td>
                <td>{a.types?.love || 0}</td>
                <td>{a.types?.fire || 0}</td>
                <td>{a.types?.idea || 0}</td>
                <td style={{ fontWeight: 700 }}>{a.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Reaction</th>
              <th>User</th>
              <th>Article</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4}><div className="skeleton" style={{ height: 180 }} /></td></tr>}
            {!loading && reactions.length === 0 && <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 32 }}>No reactions yet.</td></tr>}
            {!loading && reactions.map((r) => {
              const Icon = TYPE_ICON[r.type] || HeartIcon;
              return (
                <tr key={r.id}>
                  <td><span className={`badge badge-${r.type === 'love' || r.type === 'fire' ? 'pending' : 'admin'}`}><Icon /> {r.type}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar user={{ name: r.user_name, avatar: r.user_avatar }} size="sm" />
                      <div>
                        <div style={{ fontWeight: 600 }}>{r.user_name}</div>
                        <div className="small muted">{r.user_email}</div>
                      </div>
                    </div>
                  </td>
                  <td><Link to={`/article/${r.article_id}`} style={{ color: 'var(--primary)' }}>{r.article_title}</Link></td>
                  <td className="small muted">{formatDateTime(r.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}
