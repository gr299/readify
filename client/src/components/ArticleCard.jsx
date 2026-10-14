import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from './Avatar.jsx';
import { formatDate } from '../api.js';
import { CommentIcon, EyeIcon, HeartIcon } from './Icons.jsx';

export function ArticleCard({ article }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const cover = article.cover_image || '/cover-placeholder.svg';
  return (
    <article className="article-card">
      <Link to={`/article/${article.id}`} className="article-card-cover" tabIndex={-1} aria-hidden="true">
        <img
          src={cover}
          alt=""
          loading="lazy"
          className={imgLoaded ? 'loaded' : ''}
          onLoad={() => setImgLoaded(true)}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
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

export function ArticleCardSkeleton() {
  return (
    <article className="article-card skeleton-card" aria-hidden="true">
      <div className="article-card-cover skeleton" />
      <div className="article-card-body">
        <div className="article-card-meta">
          <span className="skeleton" style={{ width: 75, height: 20, borderRadius: 999 }} />
          <span className="skeleton" style={{ width: 60, height: 14 }} />
          <span className="skeleton" style={{ width: 70, height: 14 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '6px 0' }}>
          <div className="skeleton" style={{ height: 22, width: '92%' }} />
          <div className="skeleton" style={{ height: 22, width: '60%' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '4px 0 10px' }}>
          <div className="skeleton" style={{ height: 14, width: '100%' }} />
          <div className="skeleton" style={{ height: 14, width: '80%' }} />
        </div>
        <div className="article-card-foot">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="skeleton" style={{ width: 28, height: 28, borderRadius: '50%' }} />
            <span className="skeleton" style={{ width: 75, height: 14 }} />
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="skeleton" style={{ width: 35, height: 14 }} />
            <span className="skeleton" style={{ width: 30, height: 14 }} />
            <span className="skeleton" style={{ width: 30, height: 14 }} />
          </span>
        </div>
      </div>
    </article>
  );
}
