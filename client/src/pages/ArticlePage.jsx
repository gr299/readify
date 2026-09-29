import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, formatDate, formatDateTime } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { ReactionButton } from '../components/ReactionButton.jsx';
import { CommentSection } from '../components/CommentSection.jsx';
import { StatusBadge } from '../components/Badges.jsx';
import { ConfirmationModal } from '../components/ConfirmationModal.jsx';
import {
  BookmarkIcon, CommentIcon, EditIcon, EyeIcon, ShareIcon, TrashIcon,
  ClockIcon, BookIcon, ArrowLeftIcon,
} from '../components/Icons.jsx';

export default function ArticlePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get(`/api/articles/${id}`);
      setArticle(data.article);
      setBookmarked(data.article.bookmarked);
    } catch (e) {
      if (e.status === 404) setNotFound(true);
      else toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const toggleBookmark = async () => {
    if (!user) return navigate('/login');
    try {
      const data = await api.post(`/api/articles/${article.id}/bookmark`);
      setBookmarked(data.bookmarked);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: article.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast('Link copied to clipboard', 'success');
      }
    } catch {
      toast('Could not share', 'error');
    }
  };

  const scrollToComments = () => {
    document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth' });
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await api.del(`/api/articles/${article.id}`);
      toast('Article deleted', 'success');
      navigate(user?.role === 'admin' ? '/admin/articles' : '/dashboard');
    } catch (e) {
      toast(e.message, 'error');
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="container-narrow" style={{ paddingTop: 40 }}>
        <div className="skeleton" style={{ height: 28, width: '60%', marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 360, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 16, marginBottom: 10 }} />
        <div className="skeleton" style={{ height: 16, width: '80%', marginBottom: 10 }} />
        <div className="skeleton" style={{ height: 16, width: '50%' }} />
      </div>
    );
  }

  if (notFound || !article) {
    return (
      <div className="container-narrow" style={{ paddingTop: 80, textAlign: 'center' }}>
        <h1>Article not found</h1>
        <p className="muted">It may have been removed or is not yet published.</p>
        <div style={{ marginTop: 20 }}>
          <Link to="/" className="btn btn-primary">Back home</Link>
        </div>
      </div>
    );
  }

  const { permissions } = article;

  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 8 }}>
        <ArrowLeftIcon /> Back
      </button>

      <div className="reader-layout">
        <article>
          <header className="reader-head" style={{ padding: '24px 0 20px' }}>
            {article.status !== 'published' && (
              <div className="row" style={{ marginBottom: 14 }}>
                <StatusBadge status={article.status} />
                {article.status === 'rejected' && article.rejection_reason && (
                  <span className="small muted">Reason: {article.rejection_reason}</span>
                )}
              </div>
            )}
            <div className="category" style={{ marginBottom: 14 }}>
              {article.category && (
                <Link to={`/discover?category=${article.category.slug}`} className="badge badge-category" style={{ padding: '6px 14px' }}>
                  {article.category.name}
                </Link>
              )}
            </div>
            <h1>{article.title}</h1>
            {article.summary && <p className="summary">{article.summary}</p>}
            <div className="reader-meta">
              {article.author && (
                <>
                  <Link to={`/authors/${article.author.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <Avatar user={article.author} size="sm" />
                    <span style={{ fontWeight: 600 }}>{article.author_display}</span>
                  </Link>
                  <span className="muted">·</span>
                </>
              )}
              <span className="muted">{formatDate(article.published_at || article.created_at)}</span>
              <span className="muted">·</span>
              <span className="muted"><ClockIcon style={{ verticalAlign: '-2px' }} /> {article.reading_time} min read</span>
              <span className="muted">·</span>
              <span className="muted"><EyeIcon style={{ verticalAlign: '-2px' }} /> {article.views_count.toLocaleString()} views</span>
            </div>
          </header>

          {article.cover_image && (
            <div className="reader-cover">
              <img src={article.cover_image} alt="" />
            </div>
          )}

          <div className="reader-tools">
            <ReactionButton
              articleId={article.id}
              initialCounts={article.reaction_counts}
              initialReaction={article.user_reaction}
            />
            <button className="reaction-btn" onClick={scrollToComments}>
              <CommentIcon /> <span>{article.comments_count}</span> Comment
            </button>
            <button className="reaction-btn" onClick={toggleBookmark}>
              <BookmarkIcon style={bookmarked ? { fill: 'currentColor' } : undefined} /> {bookmarked ? 'Saved' : 'Save'}
            </button>
            <button className="reaction-btn" onClick={share}>
              <ShareIcon /> Share
            </button>

            {permissions?.can_edit && (
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <Link to={`/article/${article.id}/edit`} className="btn btn-outline btn-sm">
                  <EditIcon /> Edit
                </Link>
                {permissions.can_delete && (
                  <button className="btn btn-danger-outline btn-sm" onClick={() => setDeleteOpen(true)}>
                    <TrashIcon /> Delete
                  </button>
                )}
              </span>
            )}
          </div>

          <div className="reader-content" dangerouslySetInnerHTML={{ __html: article.content }} />

          {article.tags.length > 0 && (
            <div className="reader-tags">
              {article.tags.map((t) => (
                <Link key={t.id} to={`/discover?tag=${t.slug}`} className="tag-pill">#{t.name}</Link>
              ))}
            </div>
          )}

          <div className="small muted" style={{ borderTop: '1px solid var(--line)', paddingTop: 16, marginTop: 24 }}>
            Published {formatDateTime(article.published_at || article.created_at)} · Last updated {formatDateTime(article.updated_at)}
          </div>

          <div id="comments">
            <CommentSection articleId={article.id} count={article.comments_count} />
          </div>
        </article>

        <aside className="reader-sidebar">
          {article.author && (
            <div className="reader-author-card">
              <Avatar user={article.author} size="lg" />
              <div>
                <div className="small muted" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>About the author</div>
                <Link to={`/authors/${article.author.id}`} style={{ fontWeight: 700, fontSize: '1.05rem' }}>{article.author_display}</Link>
                {article.author.bio ? (
                  <p className="small muted" style={{ marginTop: 6 }}>{article.author.bio}</p>
                ) : (
                  <p className="small muted" style={{ marginTop: 6 }}>
                    Writes for Readify. View all of {article.author.name.split(' ')[0]}'s articles.
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="reader-author-card">
            <BookIcon style={{ fontSize: '1.3rem', color: 'var(--primary)' }} />
            <div>
              <div className="small muted" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Enjoyed this?</div>
              <p className="small" style={{ marginTop: 6 }}>
                Save it to read later or share it with someone who would love it.
              </p>
            </div>
          </div>
        </aside>
      </div>

      <ConfirmationModal
        open={deleteOpen}
        title="Delete this article?"
        message="Are you sure you want to delete this article? This action is permanent and cannot be undone."
        confirmLabel="Delete article"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteOpen(false)}
        busy={deleting}
      />
    </div>
  );
}
