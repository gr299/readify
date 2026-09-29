import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, formatDate } from '../api.js';
import { Avatar } from '../components/Avatar.jsx';
import { ArticleCard } from '../components/ArticleCard.jsx';
import { Pagination } from '../components/Pagination.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { PlusIcon, XIcon, EditIcon } from '../components/Icons.jsx';

const SOCIAL_LINKS = {
  website: { label: 'Website', href: (v) => v },
  github: { label: 'GitHub', href: (v) => `https://github.com/${v}` },
  twitter: { label: 'X', href: (v) => `https://x.com/${v.replace(/^@/, '')}` },
  google: { label: 'Google', href: (v) => `https://developers.google.com/profile/u/${v}` },
  linkedin: { label: 'LinkedIn', href: (v) => `https://www.linkedin.com/in/${v}` },
};

export default function AuthorProfilePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [author, setAuthor] = useState(null);
  const [articles, setArticles] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [modal, setModal] = useState(null); // 'followers' | 'following' | null
  const [list, setList] = useState([]);

  const isSelf = user && user.id === Number(id);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    api.get(`/api/users/${id}?page=${page}`)
      .then((d) => {
        setAuthor({ ...d.user, interests: d.interests });
        setArticles(d.articles);
        setTotal(d.total);
        setTotalPages(d.total_pages);
        setFollowing(!!d.user.is_following);
      })
      .catch((e) => e.status === 404 && setNotFound(true))
      .finally(() => setLoading(false));
  }, [id, page]);

  const toggleFollow = async () => {
    if (!user) {
      toast('Log in to follow authors', 'error');
      return;
    }
    setFollowBusy(true);
    try {
      const res = following
        ? await api.del(`/api/users/${id}/follow`)
        : await api.post(`/api/users/${id}/follow`);
      setFollowing(res.following);
      setAuthor((a) => ({ ...a, follower_count: res.follower_count }));
    } catch (err) {
      toast(err.message || 'Could not update follow', 'error');
    } finally {
      setFollowBusy(false);
    }
  };

  const openList = async (kind) => {
    setModal(kind);
    setList([]);
    try {
      const d = await api.get(`/api/users/${id}/${kind}?limit=50`);
      setList(d[`${kind}`] || []);
    } catch {
      setList([]);
    }
  };

  if (loading) {
    return <div className="container" style={{ padding: '60px 20px' }}><div className="skeleton" style={{ height: 200 }} /><div className="grid" style={{ marginTop: 24 }}>{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 300 }} />)}</div></div>;
  }

  if (notFound || !author) {
    return (
      <div className="container-narrow" style={{ paddingTop: 80, textAlign: 'center' }}>
        <h1>Author not found</h1>
        <div style={{ marginTop: 20 }}><a className="btn btn-primary" href="/">Back home</a></div>
      </div>
    );
  }

  const socials = Object.entries(SOCIAL_LINKS)
    .filter(([key]) => author[key])
    .map(([key, cfg]) => ({ key, label: cfg.label, href: cfg.href(author[key]) }));

  const stats = [
    { label: 'Articles', value: author.total_published },
    { label: 'Views', value: author.total_views ?? 0 },
    { label: 'Reactions', value: author.total_reactions ?? 0 },
    { label: 'Comments', value: author.total_comments ?? 0 },
  ];

  return (
    <div className="container" style={{ paddingTop: 32 }}>
      <div className="profile-header">
        <div className="profile-banner" />
        <div className="profile-body">
          <div className="profile-top">
            <div className="profile-avatar">
              <Avatar user={author} size="xl" />
            </div>
            <div className="profile-info">
              <div className="profile-name-row">
                <h1>{author.name}</h1>
                {isSelf ? (
                  <a href="/profile" className="btn btn-outline btn-sm"><EditIcon /> Edit profile</a>
                ) : (
                  <button className={`btn ${following ? 'btn-outline' : 'btn-primary'}`} onClick={toggleFollow} disabled={followBusy}>
                    {following ? <><XIcon /> Unfollow</> : <><PlusIcon /> Follow</>}
                  </button>
                )}
              </div>
              {author.bio && <p className="profile-bio">{author.bio}</p>}
              {socials.length > 0 && (
                <div className="profile-social">
                  {socials.map((s) => (
                    <a key={s.key} href={s.href} target="_blank" rel="noopener noreferrer" className="profile-social-link">
                      {s.label}
                    </a>
                  ))}
                </div>
              )}
              <p className="small muted profile-meta">Member since {formatDate(author.created_at)}</p>
            </div>
          </div>

          <div className="profile-stats">
            {stats.map((s) => (
              <div key={s.label} className="profile-stat">
                <div className="profile-stat-value">{s.value.toLocaleString()}</div>
                <div className="profile-stat-label">{s.label.toLowerCase()}</div>
              </div>
            ))}
            <button className="profile-stat profile-stat-link" onClick={() => openList('followers')}>
              <div className="profile-stat-value">{author.follower_count}</div>
              <div className="profile-stat-label">followers</div>
            </button>
            <button className="profile-stat profile-stat-link" onClick={() => openList('following')}>
              <div className="profile-stat-value">{author.following_count ?? 0}</div>
              <div className="profile-stat-label">following</div>
            </button>
          </div>
        </div>
      </div>

      {author.interests?.length > 0 && (
        <div className="profile-interests">
          <span className="small muted">Interests:</span>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {author.interests.map((t) => (
              <span key={t.id} className="chip active">{t.name}</span>
            ))}
          </div>
        </div>
      )}

      <div className="section-head">
        <h2>Published articles</h2>
      </div>
      <div className="grid">
        {articles.map((a) => <ArticleCard key={a.id} article={a} />)}
      </div>
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label={modal === 'followers' ? 'Followers' : 'Following'} onClick={(e) => e.stopPropagation()}>
            <h3>{modal === 'followers' ? 'Followers' : 'Following'}</h3>
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {list.length === 0 ? (
                <p className="muted">No one {modal === 'followers' ? 'follows' : 'is followed by'} this author yet.</p>
              ) : (
                <div className="stack" style={{ gap: 12 }}>
                  {list.map((u) => (
                    <a key={u.id} href={`/authors/${u.id}`} className="row" style={{ gap: 10, alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
                      <Avatar user={u} size="sm" />
                      <div>
                        <div><strong>{u.name}</strong></div>
                        {u.bio && <div className="small muted">{u.bio}</div>}
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
