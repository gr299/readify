import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { ArticleCard } from '../components/ArticleCard.jsx';
import { SearchBar } from '../components/SearchBar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { UploadIcon, LightbulbIcon } from '../components/Icons.jsx';

export default function HomePage() {
  const { user } = useAuth();
  const [latest, setLatest] = useState([]);
  const [viewed, setViewed] = useState([]);
  const [reacted, setReacted] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [forYou, setForYou] = useState([]);
  const [hasInterests, setHasInterests] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/articles?sort=latest&limit=8'),
      api.get('/api/articles?sort=most-viewed&limit=4'),
      api.get('/api/articles?sort=most-reacted&limit=4'),
      api.get('/api/articles?featured=1&limit=6'),
      api.get('/api/categories'),
      api.get('/api/tags?limit=16'),
      user ? api.get('/api/articles/for-you') : Promise.resolve(null),
    ])
      .then(([l, v, r, f, c, t, fy]) => {
        setLatest(l.articles);
        setViewed(v.articles);
        setReacted(r.articles);
        setFeatured(f.articles);
        setCategories(c.categories);
        setTags(t.tags);
        if (fy) {
          setForYou(fy.articles);
          setHasInterests(fy.has_interests);
        }
      })
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div>
      <section className="hero">
        <div className="container">
          <span className="eyebrow">Read. Write. Share.</span>
          <h1>Great stories, thoughtfully written.</h1>
          <p>
            Readify is a home for articles worth your time — and a place to publish your own ideas, notes, and expertise.
          </p>
          <div className="hero-search">
            <SearchBar large />
          </div>
          <div className="row" style={{ marginTop: 22, gap: 8 }}>
            {categories.slice(0, 6).map((c) => (
              <Link key={c.id} to={`/discover?category=${c.slug}`} className="badge badge-category" style={{ padding: '7px 14px', fontSize: '0.82rem' }}>
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {user && (
        <div className="container">
          <div className="alert alert-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Ready to share what you know? Your next article starts here.</span>
            <Link to="/upload" className="btn btn-primary btn-sm">
              <UploadIcon /> Write an article
            </Link>
          </div>
        </div>
      )}

      {user && (
        <section className="container" style={{ marginTop: 40 }}>
          <div className="section-head">
            <div>
              <span className="eyebrow">Tailored to you</span>
              <h2>For you</h2>
              <p className="sub">Picks from the topics you follow.</p>
            </div>
            <Link to="/profile" className="btn btn-outline btn-sm">Edit interests</Link>
          </div>
          {!hasInterests ? (
            <div className="empty-state">
              <div className="icon"><LightbulbIcon style={{ fontSize: '2.2rem' }} /></div>
              <h3>Make Readify yours</h3>
              <p style={{ marginTop: 6 }}>Pick a few topics you care about and we'll surface matching articles here.</p>
              <Link to="/profile" className="btn btn-primary" style={{ marginTop: 16 }}>Choose interests</Link>
            </div>
          ) : forYou.length === 0 ? (
            <div className="empty-state">
              <p>No articles match your interests yet — new ones will appear here.</p>
            </div>
          ) : (
            <div className="grid">
              {forYou.map((a) => <ArticleCard key={a.id} article={a} />)}
            </div>
          )}
        </section>
      )}

      {featured.length > 0 && (
        <section className="container featured-section">
          <div className="section-head">
            <div>
              <span className="eyebrow">Editor's pick</span>
              <h2>Featured articles</h2>
              <p className="sub">Hand-picked stories chosen by the Readify editors.</p>
            </div>
            <Link to="/discover" className="btn btn-outline btn-sm">View all</Link>
          </div>
          <div className="grid">
            {featured.map((a) => <ArticleCard key={a.id} article={a} />)}
          </div>
        </section>
      )}

      <section className="container">
        <div className="section-head">
          <div>
            <h2>Latest articles</h2>
            <p className="sub">Fresh from the Readify feed.</p>
          </div>
          <Link to="/discover" className="btn btn-outline btn-sm">View all</Link>
        </div>
        {loading ? (
          <div className="grid">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 320 }} />)}</div>
        ) : latest.length === 0 ? (
          <div className="empty-state"><p>No articles published yet. Check back soon!</p></div>
        ) : (
          <div className="grid">
            {latest.map((a) => <ArticleCard key={a.id} article={a} />)}
          </div>
        )}
      </section>

      {(viewed.length > 0 || reacted.length > 0) && (
        <section className="container">
          <div className="two-col">
            {viewed.length > 0 && (
              <div>
                <div className="section-head" style={{ margin: '40px 0 16px' }}>
                  <h2 style={{ fontSize: '1.35rem' }}>Most viewed</h2>
                </div>
                <div className="stack">
                  {viewed.map((a) => <ArticleCard key={a.id} article={a} />)}
                </div>
              </div>
            )}
            {reacted.length > 0 && (
              <div>
                <div className="section-head" style={{ margin: '40px 0 16px' }}>
                  <h2 style={{ fontSize: '1.35rem' }}>Most reacted</h2>
                </div>
                <div className="stack">
                  {reacted.map((a) => <ArticleCard key={a.id} article={a} />)}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {tags.length > 0 && (
        <section className="container">
          <div className="section-head" style={{ marginTop: 48 }}>
            <h2 style={{ fontSize: '1.35rem' }}>Explore topics</h2>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {tags.map((t) => (
              <Link key={t.id} to={`/discover?tag=${t.slug}`} className="tag-pill">
                #{t.name} <span className="muted">({t.article_count})</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {!user && (
        <section className="container" style={{ padding: '56px 0' }}>
          <div style={{ background: 'var(--primary)', borderRadius: 'var(--radius)', padding: '44px 32px', color: '#fff', textAlign: 'center' }}>
            <h2 style={{ color: '#fff', fontSize: '1.8rem' }}>Start writing today</h2>
            <p style={{ marginTop: 8, opacity: 0.9, maxWidth: 480, margin: '8px auto 0' }}>
              Create an account to upload articles, submit them for publishing, and build your author profile.
            </p>
            <div className="row" style={{ justifyContent: 'center', marginTop: 22 }}>
              <Link to="/register" className="btn btn-lg" style={{ background: '#fff', color: 'var(--primary)' }}>Create free account</Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
