import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Avatar } from '../components/Avatar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { SaveIcon, UploadIcon, XIcon, GlobeIcon, GitHubIcon, TwitterIcon, LinkedInIcon, GoogleIcon } from '../components/Icons.jsx';

const MAX_INTERESTS = 5;
const CHIPS_VISIBLE = 12;

const SOCIAL_FIELDS = [
  { key: 'website', label: 'Website', placeholder: 'https://yoursite.com', hint: 'Full URL required' },
  { key: 'github', label: 'GitHub username', placeholder: 'octocat' },
  { key: 'twitter', label: 'X (Twitter) handle', placeholder: '@handle' },
  { key: 'google', label: 'Google Developers profile', placeholder: 'username' },
  { key: 'linkedin', label: 'LinkedIn username', placeholder: 'username' },
];

const SOCIAL_ICONS = {
  website: GlobeIcon,
  github: GitHubIcon,
  twitter: TwitterIcon,
  google: GoogleIcon,
  linkedin: LinkedInIcon,
};

export default function MyProfilePage() {
  const { user, refresh } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState(null);
  const [allTags, setAllTags] = useState([]);
  const [interestIds, setInterestIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name || '',
      bio: user.bio || '',
      avatar: user.avatar || '',
      website: user.website || '',
      github: user.github || '',
      twitter: user.twitter || '',
      google: user.google || '',
      linkedin: user.linkedin || '',
    });
    api.get('/api/tags?limit=50').then((d) => setAllTags(d.tags)).catch(() => {});
    api.get('/api/users/me/interests')
      .then((d) => setInterestIds(d.interests.map((t) => t.id)))
      .catch(() => {});
  }, [user]);

  if (!form) {
    return <div className="container" style={{ padding: '60px 20px' }}><div className="skeleton" style={{ height: 200 }} /></div>;
  }

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const onAvatarFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = await api.upload('/api/uploads/images', [file]);
      const url = data.images?.[0]?.url;
      if (url) set('avatar', url);
    } catch (err) {
      toast(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const toggleInterest = (id) => {
    setInterestIds((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= MAX_INTERESTS) {
        toast(`Choose up to ${MAX_INTERESTS} interests`, 'error');
        return cur;
      }
      return [...cur, id];
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.patch('/api/users/me', {
        name: form.name,
        bio: form.bio,
        avatar: form.avatar,
        website: form.website,
        github: form.github,
        twitter: form.twitter,
        google: form.google,
        linkedin: form.linkedin,
      });
      await api.put('/api/users/me/interests', { tag_ids: interestIds });
      await refresh();
      toast('Profile updated', 'success');
    } catch (err) {
      toast(err.message || 'Could not save profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const collapsed = allTags.slice(0, CHIPS_VISIBLE);
  const pinned = allTags.slice(CHIPS_VISIBLE).filter((t) => interestIds.includes(t.id));
  const visibleTags = showAll ? allTags : [...collapsed, ...pinned];
  const hiddenCount = allTags.length - visibleTags.length;

  return (
    <div className="acct-page">
      <div className="page-head">
        <h1>My Profile</h1>
        <p className="sub">Make your author profile yours — this is what readers see on your public page.</p>
      </div>

      <div className="form-card">
        <div className="edit-avatar">
          <div className="avatar-ring">
            <Avatar user={{ name: form.name, avatar: form.avatar }} size="xl" />
          </div>
          <div className="edit-avatar-actions">
            <label className="btn btn-outline btn-sm" style={{ display: 'inline-flex', gap: 6 }}>
              {uploading ? 'Uploading…' : (<><UploadIcon /> Upload photo</>)}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={onAvatarFile} disabled={uploading} />
            </label>
            {form.avatar && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => set('avatar', '')}>
                <XIcon /> Remove photo
              </button>
            )}
          </div>
          <span className="hint">JPG, PNG, GIF, WebP, SVG, or AVIF · Max 5 MB</span>
        </div>

        <div className="field">
          <label htmlFor="pf-name">Display name</label>
          <input id="pf-name" value={form.name} maxLength={80} onChange={(e) => set('name', e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="pf-bio">Bio</label>
          <textarea
            id="pf-bio"
            className="textarea-lg"
            maxLength={500}
            placeholder="Tell readers a little about yourself, your interests, and what you write about."
            value={form.bio}
            onChange={(e) => set('bio', e.target.value)}
          />
          <span className="counter small muted">{form.bio.length}/500</span>
        </div>

        <h3 className="acct-subhead">Social links</h3>
        {SOCIAL_FIELDS.map((s) => {
          const FieldIcon = SOCIAL_ICONS[s.key];
          return (
            <div className="field" key={s.key}>
              <label htmlFor={`pf-${s.key}`}>{s.label}</label>
              <div className="icon-input">
                {FieldIcon && <FieldIcon />}
                <input id={`pf-${s.key}`} placeholder={s.placeholder} value={form[s.key]} onChange={(e) => set(s.key, e.target.value)} />
              </div>
              {s.hint && <span className="hint small muted">{s.hint}</span>}
            </div>
          );
        })}

        <h3 className="acct-subhead">
          Your interests <span className="muted small">({interestIds.length}/{MAX_INTERESTS})</span>
        </h3>
        <p className="small muted" style={{ marginBottom: 12 }}>
          Pick topics you care about — we'll use them to tailor a "For you" section on your home page.
        </p>
        {allTags.length === 0 ? (
          <p className="small muted">No tags available yet.</p>
        ) : (
          <>
            <div className="chip-list">
              {visibleTags.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`chip ${interestIds.includes(t.id) ? 'active' : ''}`}
                  onClick={() => toggleInterest(t.id)}
                  aria-pressed={interestIds.includes(t.id)}
                >
                  #{t.name}
                </button>
              ))}
            </div>
            {hiddenCount > 0 && (
              <button type="button" className="chip-toggle" onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Show fewer' : `Show more (${hiddenCount})`}
              </button>
            )}
          </>
        )}

        <div className="acct-actions" style={{ marginTop: 26 }}>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            <SaveIcon /> {saving ? 'Saving…' : 'Save profile'}
          </button>
          <Link to={`/authors/${user.id}`} className="btn btn-ghost">View public profile</Link>
        </div>
      </div>
    </div>
  );
}
