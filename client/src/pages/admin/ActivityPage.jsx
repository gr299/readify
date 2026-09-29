import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, timeAgo } from '../../api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Avatar } from '../../components/Avatar.jsx';
import { ActivityIcon, FileTextIcon, CommentIcon, HeartIcon, TagIcon, LayersIcon, UsersIcon, SettingsIcon, StarIcon, EditIcon, ArchiveIcon, CheckIcon, XIcon, InboxIcon, KeyIcon, TrashIcon } from '../../components/Icons.jsx';

const ACTION_META = {
  'account.created': { label: 'created an account', Icon: UsersIcon },
  'auth.login': { label: 'signed in', Icon: KeyIcon },
  'article.created': { label: 'created an article', Icon: FileTextIcon },
  'article.updated': { label: 'updated an article', Icon: EditIcon },
  'article.published': { label: 'published an article', Icon: CheckIcon },
  'article.pending': { label: 'submitted an article for review', Icon: InboxIcon },
  'article.rejected': { label: 'rejected an article', Icon: XIcon },
  'article.draft': { label: 'moved an article back to draft', Icon: FileTextIcon },
  'article.archived': { label: 'archived an article', Icon: ArchiveIcon },
  'article.deleted': { label: 'deleted an article', Icon: TrashIcon },
  'article.featured': { label: 'featured an article', Icon: StarIcon },
  'article.unfeatured': { label: 'removed an article from featured', Icon: StarIcon },
  'comment.created': { label: 'commented on an article', Icon: CommentIcon },
  'comment.updated': { label: 'edited a comment', Icon: CommentIcon },
  'comment.deleted': { label: 'deleted a comment', Icon: CommentIcon },
  'reaction.upsert': { label: 'reacted to an article', Icon: HeartIcon },
  'reaction.removed': { label: 'removed a reaction', Icon: HeartIcon },
  'category.created': { label: 'created a category', Icon: LayersIcon },
  'category.updated': { label: 'renamed a category', Icon: LayersIcon },
  'category.deleted': { label: 'deleted a category', Icon: LayersIcon },
  'tag.created': { label: 'created a tag', Icon: TagIcon },
  'tag.updated': { label: 'renamed a tag', Icon: TagIcon },
  'tag.deleted': { label: 'deleted a tag', Icon: TagIcon },
  'user.deleted': { label: 'deleted a user account', Icon: UsersIcon },
  'user.role_changed': { label: 'changed a user role', Icon: UsersIcon },
  'settings.updated': { label: 'updated site settings', Icon: SettingsIcon },
};

function ActivityIconFor(action) {
  const meta = ACTION_META[action];
  return meta?.Icon || ActivityIcon;
}

function describe(activity) {
  const meta = ACTION_META[activity.action];
  let suffix = '';
  if (activity.meta) {
    try {
      const parsed = typeof activity.meta === 'string' ? JSON.parse(activity.meta) : activity.meta;
      if (parsed?.title) suffix = ` "${parsed.title}"`;
      else if (parsed?.name) suffix = ` "${parsed.name}"`;
      else if (parsed?.role) suffix = ` to ${parsed.role}`;
      else if (parsed?.keys?.length) suffix = `: ${parsed.keys.join(', ')}`;
    } catch {
      /* ignore malformed meta */
    }
  }
  return { text: meta ? `${meta.label}${suffix}` : `${activity.action}${suffix}` };
}

export default function ActivityPage() {
  const { toast } = useToast();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/admin/activities?limit=50')
      .then((d) => setActivities(d.activities))
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  const target = (activity) => {
    if (activity.entity_type === 'article' && activity.entity_id) {
      return { to: `/article/${activity.entity_id}`, label: 'View article' };
    }
    if (activity.entity_type === 'user' && activity.entity_id) {
      return { to: `/authors/${activity.entity_id}`, label: 'View profile' };
    }
    return null;
  };

  return (
    <div>
      <div className="page-head" style={{ padding: '0 0 16px' }}>
        <h1>Activity log</h1>
        <p className="sub">A chronological record of key actions across the platform.</p>
      </div>

      <div className="form-card">
        {loading && <div className="skeleton" style={{ height: 320 }} />}
        {!loading && activities.length === 0 && (
          <p className="muted" style={{ textAlign: 'center', padding: 32 }}>No activity recorded yet.</p>
        )}
        {!loading && activities.length > 0 && (
          <div className="activity-list">
            {activities.map((a) => {
              const Icon = ActivityIconFor(a.action);
              const { text } = describe(a);
              const link = target(a);
              return (
                <div className="activity-item" key={a.id}>
                  <div className="activity-icon"><Icon /></div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ color: 'var(--primary)' }}>{a.user_name}</span> {text}
                    </div>
                    <div className="small muted">{timeAgo(a.created_at)}</div>
                  </div>
                  {link && <Link to={link.to} className="btn btn-ghost btn-sm">{link.label}</Link>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
