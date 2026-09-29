import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useNavigate } from 'react-router-dom';
import { HeartIcon, FireIcon, LightbulbIcon, ThumbsUpIcon } from './Icons.jsx';

const TYPES = [
  { key: 'like', label: 'Like', Icon: ThumbsUpIcon },
  { key: 'love', label: 'Love', Icon: HeartIcon },
  { key: 'fire', label: 'Fire', Icon: FireIcon },
  { key: 'idea', label: 'Idea', Icon: LightbulbIcon },
];

export function ReactionButton({ articleId, initialCounts, initialReaction }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [counts, setCounts] = useState(initialCounts || { like: 0, love: 0, fire: 0, idea: 0, total: 0 });
  const [reaction, setReaction] = useState(initialReaction || null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const total = counts?.total ?? 0;

  const act = async (type) => {
    if (!user) return navigate('/login');
    setBusy(true);
    try {
      if (reaction === type) {
        await api.del(`/api/articles/${articleId}/reactions`);
        setCounts((c) => {
          const nc = { ...c, [type]: Math.max(0, (c[type] || 0) - 1), total: Math.max(0, (c.total || 0) - 1) };
          return nc;
        });
        setReaction(null);
      } else {
        const data = await api.post(`/api/articles/${articleId}/reactions`, { type });
        setCounts(data.counts);
        setReaction(data.user_reaction);
      }
    } catch (e) {
      toast(e.message || 'Could not update reaction', 'error');
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  const current = TYPES.find((t) => t.key === reaction);

  return (
    <div className="reaction-wrap" style={{ position: 'relative' }}>
      {open && (
        <div
          className="reaction-pop"
          style={{
            position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, display: 'flex', gap: 4,
            background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 999,
            boxShadow: 'var(--shadow-lg)', padding: 6, zIndex: 40,
          }}
        >
          {TYPES.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              className={`reaction-btn btn-sm ${reaction === key ? 'active' : ''}`}
              style={{ padding: '6px 10px' }}
              onClick={() => act(key)}
              title={label}
            >
              <Icon />
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        className={`reaction-btn ${reaction ? 'active' : ''}`}
        disabled={busy}
        onClick={() => (reaction ? act(reaction) : setOpen((v) => !v))}
      >
        {current ? <current.Icon /> : <HeartIcon />}
        {total > 0 ? total : ''}
        <span className="small" style={{ color: 'var(--ink-mute)', fontWeight: 500 }}>
          {reaction ? TYPES.find((t) => t.key === reaction).label : 'React'}
        </span>
      </button>
    </div>
  );
}
