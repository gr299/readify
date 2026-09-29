import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { ArticleEditor } from '../components/ArticleEditor.jsx';
import { StatusBadge } from '../components/Badges.jsx';
import { useCrop } from '../context/CropContext.jsx';
import { SaveIcon, SendIcon, XIcon, UploadIcon, EditIcon } from '../components/Icons.jsx';
import { ImageIcon } from '../components/EditorIcons.jsx';

export default function ArticleEditorPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { user } = useAuth();
  const { toast } = useToast();
  const { cropFile } = useCrop();
  const navigate = useNavigate();
  const coverRef = useRef(null);
  const galleryRef = useRef(null);

  const [categories, setCategories] = useState([]);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [gallery, setGallery] = useState([]);
  const [tagsInput, setTagsInput] = useState('');
  const [status, setStatus] = useState('draft');
  const [featured, setFeatured] = useState(false);
  const [publishedAt, setPublishedAt] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api.get('/api/categories').then((d) => setCategories(d.categories)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) {
      setAuthor(user?.name || '');
      return;
    }
    (async () => {
      try {
        const data = await api.get(`/api/articles/${id}`);
        const a = data.article;
        if (!a.permissions?.can_edit) {
          setNotFound(true);
          return;
        }
        setTitle(a.title || '');
        setAuthor(a.author_display || user?.name || '');
        setCategoryId(a.category ? String(a.category.id) : '');
        setSummary(a.summary || '');
        setContent(a.content || '');
        setCoverImage(a.cover_image || '');
        setTagsInput(a.tags.map((t) => t.name).join(', '));
        setStatus(a.status);
        setFeatured(!!a.featured);
        setPublishedAt(a.published_at ? a.published_at.replace(' ', 'T').slice(0, 16) : '');
      } catch (e) {
        if (e.status === 404) setNotFound(true);
        else toast(e.message, 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const parseTags = () => tagsInput.split(',').map((t) => t.trim()).filter(Boolean);

  const uploadCover = async (file) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) return toast('Cover must be an image file', 'error');
    if (file.size > 5 * 1024 * 1024) return toast('Cover image must be 5 MB or smaller', 'error');
    const cropped = await cropFile(file, { ratio: 16 / 9 });
    if (!cropped) return;
    if (cropped.size > 5 * 1024 * 1024) return toast('Cropped image is too large', 'error');
    setUploading(true);
    try {
      const data = await api.upload('/api/uploads/images', [cropped]);
      setCoverImage(data.images[0].url);
    } catch (e) {
      toast(e.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
      if (coverRef.current) coverRef.current.value = '';
    }
  };

  const uploadGallery = async (files) => {
    const arr = Array.from(files || []);
    if (!arr.length) return;
    if (arr.some((f) => !/^image\//.test(f.type))) return toast('Additional images must be image files', 'error');
    if (arr.some((f) => f.size > 5 * 1024 * 1024)) return toast('Each image must be 5 MB or smaller', 'error');
    const cropped = [];
    for (const f of arr) {
      const out = await cropFile(f, { ratio: null });
      if (!out) return;
      cropped.push(out);
    }
    setUploading(true);
    try {
      const data = await api.upload('/api/uploads/images', cropped);
      setGallery((g) => [...g, ...data.images]);
    } catch (e) {
      toast(e.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
      if (galleryRef.current) galleryRef.current.value = '';
    }
  };

  const removeCover = () => setCoverImage('');

  const save = async (targetStatus) => {
    setError('');
    if (!title.trim() || title.trim().length < 3) {
      setError('Title must be at least 3 characters');
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: title.trim(),
        author: author.trim() || null,
        category_id: categoryId ? Number(categoryId) : null,
        summary: summary.trim() || null,
        content,
        cover_image: coverImage || null,
        tags: parseTags(),
        status: targetStatus,
      };
      if (user?.role === 'admin' && isEdit) {
        body.featured = targetStatus === 'published' ? !!featured : false;
        if (targetStatus === 'published') {
          body.published_at = publishedAt ? new Date(publishedAt).toISOString() : null;
        }
      }
      if (isEdit) {
        const data = await api.put(`/api/articles/${id}`, body);
        toast('Article updated', 'success');
        if (user?.role === 'admin') navigate('/admin/articles');
        else if (targetStatus === 'pending') navigate('/dashboard?tab=pending');
        else navigate(`/article/${data.article.id}`);
      } else {
        const data = await api.post('/api/articles', body);
        toast(targetStatus === 'pending' ? 'Submitted for review' : 'Draft saved', 'success');
        if (targetStatus === 'pending') navigate('/dashboard?tab=pending');
        else navigate(`/article/${data.article.id}`);
      }
    } catch (e) {
      setError(e.message || 'Could not save article');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="container" style={{ padding: '60px 20px' }}><div className="skeleton" style={{ height: 480 }} /></div>;
  }

  if (notFound) {
    return (
      <div className="container-narrow" style={{ paddingTop: 80, textAlign: 'center' }}>
        <h1>Article not found</h1>
        <p className="muted">You do not have permission to edit this article.</p>
        <div style={{ marginTop: 20 }}><button className="btn btn-primary" onClick={() => navigate(-1)}>Go back</button></div>
      </div>
    );
  }

  return (
    <div className="container-wide" style={{ paddingTop: 28 }}>
      <div className="page-head" style={{ padding: '0 0 16px' }}>
        <span className="eyebrow">{isEdit ? 'Edit article' : 'Upload article'}</span>
        <h1 style={{ fontSize: '1.9rem' }}>{isEdit ? 'Edit your article' : 'Write a new article'}</h1>
        {isEdit && status !== 'published' && (
          <p className="sub">
            Current status: <StatusBadge status={status} />
          </p>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="editor-layout">
        <div className="stack">
          <div className="form-card">
            <div className="field">
              <label htmlFor="art-title">Article title</label>
              <input id="art-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A compelling headline" maxLength={200} />
            </div>
            <div className="two-col">
              <div className="field">
                <label htmlFor="art-author">Author (display name)</label>
                <input id="art-author" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Your name" maxLength={120} />
              </div>
              <div className="field">
                <label htmlFor="art-category">Category</label>
                <select id="art-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">Select category…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="art-summary">Description / summary</label>
              <textarea id="art-summary" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="A short summary shown in the feed (optional)" maxLength={500} />
            </div>
            <div className="field">
              <label htmlFor="art-tags">Tags</label>
              <input id="art-tags" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="javascript, web-development, ai (comma separated)" />
            </div>
          </div>

          <div className="form-card">
            <label style={{ fontWeight: 600, fontSize: '0.9rem', display: 'block', marginBottom: 10 }}>Article content</label>
            <ArticleEditor value={content} onChange={setContent} placeholder="Tell your story…" />
          </div>
        </div>

        <aside className="stack">
          <div className="form-card">
            <h3 style={{ fontSize: '1.05rem', marginBottom: 12 }}>Cover image</h3>
            {coverImage ? (
              <div className="stack" style={{ gap: 10 }}>
                <div style={{ borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--line)' }}>
                  <img src={coverImage} alt="Cover" style={{ aspectRatio: '16/9', objectFit: 'cover' }} />
                </div>
                <div className="row">
                  <button className="btn btn-ghost btn-sm" onClick={() => coverRef.current?.click()}>
                    <ImageIcon /> Replace
                  </button>
                  <button className="btn btn-danger-outline btn-sm" onClick={removeCover}>
                    <XIcon /> Remove
                  </button>
                </div>
              </div>
            ) : (
              <button className="btn btn-outline btn-block" onClick={() => coverRef.current?.click()} disabled={uploading}>
                <UploadIcon /> {uploading ? 'Uploading…' : 'Upload cover'}
              </button>
            )}
            <input ref={coverRef} type="file" accept="image/*" hidden onChange={(e) => uploadCover(e.target.files?.[0])} />
            <p className="hint" style={{ marginTop: 8 }}>JPG, PNG, GIF, WebP, SVG up to 5 MB. Recommended ratio 16:9.</p>
          </div>

          <div className="form-card">
            <h3 style={{ fontSize: '1.05rem', marginBottom: 12 }}>Additional images</h3>
            <button className="btn btn-outline btn-block btn-sm" onClick={() => galleryRef.current?.click()} disabled={uploading}>
              <UploadIcon /> {uploading ? 'Uploading…' : 'Upload images'}
            </button>
            <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={(e) => uploadGallery(e.target.files)} />
            {gallery.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {gallery.map((g) => (
                  <div key={g.url} className="row" style={{ fontSize: '0.82rem', justifyContent: 'space-between', background: 'var(--bg-alt)', padding: '6px 10px', borderRadius: 8 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{g.name}</span>
                    <button className="btn btn-ghost btn-sm" title="Insert into editor" onClick={() => {
                      const url = g.url;
                      window.dispatchEvent(new CustomEvent('readify:insert-image', { detail: { url } }));
                    }}>
                      <EditIcon />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="hint" style={{ marginTop: 8 }}>Insert images into the editor via the image button, or press the insert icon here after placing your cursor.</p>
          </div>

          <div className="form-card">
            <h3 style={{ fontSize: '1.05rem', marginBottom: 12 }}>Publishing</h3>
            <div className="stack" style={{ gap: 10 }}>
              {isEdit && <p className="small muted">Saved as <strong>{status}</strong>.</p>}
              <button className="btn btn-outline btn-block" disabled={saving} onClick={() => save('draft')}>
                <SaveIcon /> {isEdit ? 'Save changes' : 'Save as draft'}
              </button>
              {(status === 'draft' || status === 'rejected') && (
                <button className="btn btn-primary btn-block" disabled={saving} onClick={() => save('pending')}>
                  <SendIcon /> Submit for publishing
                </button>
              )}
              {isEdit && status === 'pending' && (
                <p className="small muted">This article is awaiting admin review. You can still edit it, but the status stays pending.</p>
              )}
            </div>
          </div>

          {user?.role === 'admin' && isEdit && (
            <div className="form-card admin-publish">
              <h3 style={{ fontSize: '1.05rem', marginBottom: 12 }}>Admin publishing controls</h3>
              <div className="field">
                <label htmlFor="art-status">Status</label>
                <select id="art-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="draft">Draft</option>
                  <option value="pending">Pending</option>
                  <option value="published">Published</option>
                  <option value="rejected">Rejected</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="art-pubdate">Publication date</label>
                <input id="art-pubdate" type="datetime-local" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} disabled={status !== 'published'} />
              </div>
              <div className="field">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} disabled={status !== 'published'} />
                  Feature on the home page
                </label>
              </div>
              <button className="btn btn-primary btn-block" disabled={saving || status === 'draft'} onClick={() => save(status)}>
                <SaveIcon /> {saving ? 'Saving…' : `Save as ${status}`}
              </button>
              <p className="hint" style={{ marginTop: 8 }}>The status change is applied immediately. Publication date is used when the article is published.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
