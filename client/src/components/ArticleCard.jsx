import { Link } from 'react-router-dom';
import { Avatar } from './Avatar.jsx';
import { formatDate } from '../api.js';
import { CommentIcon, EyeIcon, HeartIcon } from './Icons.jsx';

export function ArticleCard({ article }) {
  const cover = article.cover_image || '/cover-placeholder.svg';
  return (
    <article className="article-card">
      <Link to={`/article/${article.id}`} className="article-card-cover" tabIndex={-1} aria-hidden="true">
        <img src={cover} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      </Link>
      <div className="article-card-body">
        <div className="article-card-meta">
          {article.category && (
            <Link to={`/discover?category=${article.category.slug}`} className="badge badge-category">
              {article.category.name}
            </Link>
          )}
          <span>{article.reading_time} min read</span>
          <span>{formatDate(article.published_at)}</span>
        </div>
        <h3>
          <Link to={`/article/${article.id}`}>{article.title}</Link>
        </h3>
        <p className="article-card-summary">{article.summary}</p>
        <div className="article-card-foot">
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Avatar user={article.author} size="sm" />
            <span style={{ color: 'var(--ink-soft)', fontWeight: 600 }}>{article.author_display}</span>
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span title="Views" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <EyeIcon /> {article.views_count.toLocaleString()}
            </span>
            <span title="Reactions" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <HeartIcon /> {article.reactions_count}
            </span>
            <span title="Comments" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <CommentIcon /> {article.comments_count}
            </span>
          </span>
        </div>
      </div>
    </article>
  );
}
