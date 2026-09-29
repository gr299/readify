import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useCrop } from '../context/CropContext.jsx';
import {
  BoldIcon, ItalicIcon, UnderlineIcon, StrikethroughIcon, ListUlIcon, ListOlIcon,
  LinkIcon, QuoteIcon, AlignLeftIcon, AlignCenterIcon, AlignRightIcon, AlignJustifyIcon,
  ImageIcon, EyeIcon, EditIcon, ClearIcon, UndoIcon, RedoIcon, TextColorIcon,
  HighlightIcon, TextBoxIcon, RotateIcon,
} from './EditorIcons.jsx';
import { RefreshIcon, TrashIcon } from './Icons.jsx';

const FONT_FAMILIES = [
  { label: 'Georgia', family: 'Georgia', stack: 'Georgia, serif' },
  { label: 'Arial', family: 'Arial', stack: 'Arial, Helvetica, sans-serif' },
  { label: 'Verdana', family: 'Verdana', stack: 'Verdana, Geneva, sans-serif' },
  { label: 'Tahoma', family: 'Tahoma', stack: 'Tahoma, Geneva, sans-serif' },
  { label: 'Trebuchet MS', family: 'Trebuchet MS', stack: '"Trebuchet MS", Arial, sans-serif' },
  { label: 'Times New Roman', family: 'Times New Roman', stack: '"Times New Roman", Times, serif' },
  { label: 'Courier New', family: 'Courier New', stack: '"Courier New", Courier, monospace' },
  { label: 'Palatino', family: 'Palatino', stack: 'Palatino, "Palatino Linotype", serif' },
  { label: 'Garamond', family: 'Garamond', stack: 'Garamond, Georgia, serif' },
];

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48];
const LINE_SPACINGS = [1, 1.15, 1.5, 1.75, 2];
const PARA_SPACINGS = [0, 8, 16, 24, 32];
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const MIN_OBJECT_W = 40;
const MIN_OBJECT_H = 28;

function ToolbarButton({ title, onClick, active, disabled, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={active ? 'active' : ''}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function ArticleEditor({ value, onChange, placeholder = 'Start writing your story…' }) {
  const editorRef = useRef(null);
  const canvasRef = useRef(null);
  const chromeRef = useRef(null);
  const fileRef = useRef(null);
  const { toast } = useToast();
  const { cropFile } = useCrop();

  const [mode, setMode] = useState('edit');
  const [uploading, setUploading] = useState(false);
  const [selectedKey, setSelectedKey] = useState(0);
  const [hist, setHist] = useState({ canUndo: false, canRedo: false });
  const [fmt, setFmt] = useState({ bold: false, italic: false, underline: false, strike: false, align: '', fontFamily: '', fontSize: '' });

  const selectedRef = useRef(null);
  const objIdRef = useRef(1);
  const histRef = useRef({ undo: [], redo: [] });
  const pendingReplaceRef = useRef(false);

  const refreshObjectAttrs = () => {
    if (!editorRef.current) return;
    editorRef.current.querySelectorAll('.doc-object').forEach((el) => {
      if (!el.getAttribute('data-id')) el.setAttribute('data-id', `obj-${objIdRef.current++}`);
      el.setAttribute('contenteditable', 'false');
      const inner = el.querySelector('.doc-textbox-inner');
      if (inner) inner.setAttribute('contenteditable', 'true');
    });
  };

  useEffect(() => {
    if (mode === 'edit' && editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
      refreshObjectAttrs();
    }
  }, [value, mode]);

  const emitChange = () => onChange(editorRef.current?.innerHTML || '');

  const syncChrome = () => {
    const el = selectedRef.current;
    const ch = chromeRef.current;
    if (!el || !ch || !canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    ch.style.left = `${r.left - canvasRect.left}px`;
    ch.style.top = `${r.top - canvasRect.top}px`;
    ch.style.width = `${r.width}px`;
    ch.style.height = `${r.height}px`;
  };

  const selectObject = (el) => {
    selectedRef.current = el;
    setSelectedKey((k) => k + 1);
    requestAnimationFrame(syncChrome);
  };

  const clearSelection = () => {
    if (!selectedRef.current) return;
    selectedRef.current = null;
    setSelectedKey((k) => k + 1);
  };

  const pushHistory = () => {
    const h = histRef.current;
    h.undo.push(editorRef.current.innerHTML);
    if (h.undo.length > 120) h.undo.shift();
    h.redo = [];
    setHist({ canUndo: true, canRedo: false });
  };

  const undo = () => {
    const h = histRef.current;
    editorRef.current?.focus();
    if (h.undo.length) {
      h.redo.push(editorRef.current.innerHTML);
      const prev = h.undo.pop();
      editorRef.current.innerHTML = prev;
      refreshObjectAttrs();
      clearSelection();
      setHist({ canUndo: h.undo.length > 0, canRedo: true });
      emitChange();
    } else {
      document.execCommand('undo');
    }
  };

  const redo = () => {
    const h = histRef.current;
    editorRef.current?.focus();
    if (h.redo.length) {
      h.undo.push(editorRef.current.innerHTML);
      const next = h.redo.pop();
      editorRef.current.innerHTML = next;
      refreshObjectAttrs();
      clearSelection();
      setHist({ canUndo: true, canRedo: h.redo.length > 0 });
      emitChange();
    } else {
      document.execCommand('redo');
    }
  };

  const exec = (command, val = null) => {
    editorRef.current?.focus();
    document.execCommand(command, false, val);
    emitChange();
  };

  const setBlock = (tag) => {
    editorRef.current?.focus();
    document.execCommand('formatBlock', false, tag);
    emitChange();
  };

  const setFontSize = (px) => {
    editorRef.current?.focus();
    document.execCommand('styleWithCSS', false, true);
    document.execCommand('fontSize', false, '7');
    const scope = editorRef.current;
    if (!scope) return;
    scope.querySelectorAll('span[style*="xxx-large"], font[size="7"]').forEach((n) => {
      if (n.style && /xxx-large/.test(n.style.fontSize)) n.style.fontSize = `${px}px`;
      if (n.tagName === 'FONT') {
        n.removeAttribute('size');
        n.style.fontSize = `${px}px`;
      }
    });
    emitChange();
  };

  const setFontFamily = (family) => {
    const f = FONT_FAMILIES.find((x) => x.family === family);
    document.execCommand('styleWithCSS', false, true);
    exec('fontName', f ? f.stack : family);
    setFmt((s) => ({ ...s, fontFamily: family }));
  };

  const setTextColor = (color) => {
    document.execCommand('styleWithCSS', false, true);
    exec('foreColor', color);
  };

  const setHighlight = (color) => {
    document.execCommand('styleWithCSS', false, true);
    try {
      exec('hiliteColor', color);
    } catch {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      pushHistory();
      if (!sel.isCollapsed) {
        const range = sel.getRangeAt(0);
        const span = document.createElement('span');
        span.style.backgroundColor = color;
        span.appendChild(range.extractContents());
        range.insertNode(span);
      } else {
        const node = sel.anchorNode;
        const block = node && node.nodeType === 3 ? node.parentElement : node;
        if (block) block.style.backgroundColor = color;
      }
      emitChange();
    }
  };

  const getBlocksInSelection = () => {
    const sel = window.getSelection();
    const blocks = new Set();
    if (!sel || !sel.rangeCount || !editorRef.current) return [...blocks];
    const range = sel.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const top = container.nodeType === 3 ? container.parentElement : container;
    const walk = (node) => {
      let n = node;
      while (n && n !== editorRef.current && n.parentElement !== editorRef.current) n = n.parentElement;
      if (n && n !== editorRef.current) blocks.add(n);
    };
    walk(range.startContainer);
    walk(range.endContainer);
    const subtree = top && top.querySelectorAll
      ? top.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li, blockquote')
      : [];
    subtree.forEach((b) => {
      if (range.intersectsNode(b)) blocks.add(b);
    });
    if (!blocks.size && top) walk(top);
    return [...blocks];
  };

  const setBlockStyle = (prop, value) => {
    pushHistory();
    const blocks = getBlocksInSelection();
    blocks.forEach((b) => {
      b.style[prop] = value;
    });
    emitChange();
    editorRef.current?.focus();
  };

  const insertImageObject = (url, alt = '') => {
    pushHistory();
    const el = document.createElement('div');
    el.className = 'doc-object doc-image';
    el.setAttribute('data-object', 'image');
    el.setAttribute('data-id', `obj-${objIdRef.current++}`);
    el.setAttribute('contenteditable', 'false');
    el.style.cssText = 'position:absolute;left:40px;top:48px;width:360px;height:240px;transform:rotate(0deg);';
    const img = document.createElement('img');
    img.src = url;
    img.alt = alt || '';
    img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;';
    el.appendChild(img);
    editorRef.current.appendChild(el);
    const fitHeight = () => {
      if (img.naturalWidth) {
        el.style.height = `${Math.max(80, Math.round((360 * img.naturalHeight) / img.naturalWidth))}px`;
        emitChange();
      }
    };
    img.addEventListener('load', fitHeight);
    if (img.complete) fitHeight();
    selectObject(el);
    emitChange();
  };

  const insertTextBox = () => {
    pushHistory();
    const el = document.createElement('div');
    el.className = 'doc-object doc-textbox';
    el.setAttribute('data-object', 'textbox');
    el.setAttribute('data-id', `obj-${objIdRef.current++}`);
    el.setAttribute('contenteditable', 'false');
    const offset = (objIdRef.current % 3) * 32;
    el.style.cssText = `position:absolute;left:40px;top:${48 + offset}px;width:280px;height:120px;`;
    const inner = document.createElement('div');
    inner.className = 'doc-textbox-inner';
    inner.setAttribute('contenteditable', 'true');
    inner.textContent = 'Type your text here';
    el.appendChild(inner);
    editorRef.current.appendChild(el);
    selectObject(el);
    emitChange();
  };

  const startMove = (e, el) => {
    if (e.button !== 0) return;
    e.preventDefault();
    pushHistory();
    const startX = e.clientX;
    const startY = e.clientY;
    const left = parseFloat(el.style.left) || 0;
    const top = parseFloat(el.style.top) || 0;
    const pageW = editorRef.current?.clientWidth || 600;
    const pageH = editorRef.current?.clientHeight || 800;
    const onMove = (ev) => {
      const maxLeft = Math.max(0, pageW - el.offsetWidth);
      const maxTop = Math.max(0, pageH - el.offsetHeight);
      el.style.left = `${Math.max(0, Math.min(maxLeft, left + (ev.clientX - startX)))}px`;
      el.style.top = `${Math.max(0, Math.min(maxTop, top + (ev.clientY - startY)))}px`;
      syncChrome();
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      emitChange();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startResize = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const el = selectedRef.current;
    if (!el) return;
    const dir = e.currentTarget.dataset.dir;
    pushHistory();
    const sx = e.clientX;
    const sy = e.clientY;
    const L = parseFloat(el.style.left) || 0;
    const T = parseFloat(el.style.top) || 0;
    const W = parseFloat(el.style.width) || el.offsetWidth;
    const H = parseFloat(el.style.height) || el.offsetHeight;
    const isImage = el.classList.contains('doc-image');
    const isCorner = dir.length === 2;
    const pageW = editorRef.current?.clientWidth || 600;
    const pageH = editorRef.current?.clientHeight || 800;
    const onMove = (ev) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      let w = dir.includes('e') ? W + dx : dir.includes('w') ? W - dx : W;
      let h = dir.includes('s') ? H + dy : dir.includes('n') ? H - dy : H;
      if (isImage && isCorner) {
        const scale = Math.max(w / W, h / H);
        w = W * scale;
        h = H * scale;
        if (w < MIN_OBJECT_W) {
          w = MIN_OBJECT_W;
          h = H * (w / W);
        }
        if (h < MIN_OBJECT_H) {
          h = MIN_OBJECT_H;
          w = W * (h / H);
        }
      } else {
        w = Math.max(MIN_OBJECT_W, w);
        h = Math.max(MIN_OBJECT_H, h);
      }
      let left = L;
      let top = T;
      if (dir.includes('w')) left = L + (W - w);
      if (dir.includes('n')) top = T + (H - h);
      left = Math.max(0, Math.min(pageW - w, left));
      top = Math.max(0, Math.min(pageH - h, top));
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      syncChrome();
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      emitChange();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startRotate = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const el = selectedRef.current;
    if (!el) return;
    pushHistory();
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const onMove = (ev) => {
      const deg = Math.round((Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI);
      el.style.transform = `rotate(${deg}deg)`;
      syncChrome();
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      emitChange();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const deleteSelectedObject = () => {
    const el = selectedRef.current;
    if (!el) return;
    pushHistory();
    el.remove();
    clearSelection();
    emitChange();
  };

  const replaceSelectedImage = () => {
    pendingReplaceRef.current = true;
    fileRef.current?.click();
  };

  const onFilePicked = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isReplace = pendingReplaceRef.current;
    pendingReplaceRef.current = false;
    if (!/^image\//.test(file.type)) return toast('Only image files are allowed', 'error');
    if (file.size > 5 * 1024 * 1024) return toast('Image must be 5 MB or smaller', 'error');
    setUploading(true);
    try {
      const cropped = await cropFile(file, { ratio: null });
      if (!cropped) return;
      const data = await api.upload('/api/uploads/images', [cropped]);
      const url = data.images[0].url;
      if (isReplace) {
        const img = selectedRef.current?.querySelector('img');
        if (img) img.src = url;
        emitChange();
      } else {
        insertImageObject(url);
      }
    } catch (err) {
      toast(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        (async () => {
          if (!file) return;
          setUploading(true);
          try {
            const cropped = await cropFile(file, { ratio: null });
            if (!cropped) return;
            const data = await api.upload('/api/uploads/images', [cropped]);
            insertImageObject(data.images[0].url);
          } catch (err) {
            toast(err.message || 'Upload failed', 'error');
          } finally {
            setUploading(false);
          }
        })();
        break;
      }
    }
  };

  const promptLink = () => {
    const url = window.prompt('Enter the link URL (https://…)');
    if (!url) return;
    if (!/^https?:\/\/.+$/.test(url)) {
      toast('Link must be a valid http(s) URL', 'error');
      return;
    }
    exec('createLink', url);
  };

  const readFontFamily = () => {
    const sel = window.getSelection();
    const node = sel && sel.rangeCount ? sel.anchorNode : null;
    const el = node && node.nodeType === 3 ? node.parentElement : node;
    if (el) {
      const ff = getComputedStyle(el).fontFamily || '';
      return ff.split(',')[0].replace(/["']/g, '').trim();
    }
    return '';
  };

  const readFontSize = () => {
    const sel = window.getSelection();
    const node = sel && sel.rangeCount ? sel.anchorNode : null;
    const el = node && node.nodeType === 3 ? node.parentElement : node;
    if (el) {
      const px = parseFloat(getComputedStyle(el).fontSize);
      if (px) return String(Math.round(px));
    }
    return '';
  };

  useEffect(() => {
    const onSelChange = () => {
      if (!editorRef.current) return;
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      if (!editorRef.current.contains(sel.anchorNode)) return;
      let align = '';
      for (const a of ['justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull']) {
        if (document.queryCommandState(a)) {
          align = a === 'justifyFull' ? 'justify' : a.replace('justify', '').toLowerCase();
          break;
        }
      }
      setFmt({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strike: document.queryCommandState('strikeThrough'),
        align,
        fontFamily: readFontFamily(),
        fontSize: readFontSize(),
      });
    };
    document.addEventListener('selectionchange', onSelChange);
    const onResize = () => syncChrome();
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('selectionchange', onSelChange);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  useEffect(() => {
    if (selectedRef.current) requestAnimationFrame(syncChrome);
  }, [selectedKey]);

  const onPageMouseDown = (e) => {
    const obj = e.target.closest('.doc-object');
    if (!obj) {
      clearSelection();
      return;
    }
    if (e.target.closest('.doc-textbox-inner')) {
      selectObject(obj);
      return;
    }
    startMove(e, obj);
  };

  const onPageDoubleClick = (e) => {
    const obj = e.target.closest('.doc-object');
    if (!obj) return;
    const inner = obj.querySelector('.doc-textbox-inner');
    if (inner) inner.focus();
  };

  const selected = selectedRef.current;
  const selectedIsImage = selected?.classList.contains('doc-image');

  return (
    <div className="editor-shell">
      <div className="editor-toolbar" role="toolbar" aria-label="Document tools">
        <ToolbarButton title="Undo" onClick={undo} disabled={!hist.canUndo}><UndoIcon /></ToolbarButton>
        <ToolbarButton title="Redo" onClick={redo} disabled={!hist.canRedo}><RedoIcon /></ToolbarButton>
        <span className="sep" />
        <select
          className="ed-select ed-select-font"
          value={fmt.fontFamily}
          title="Font family"
          onChange={(e) => setFontFamily(e.target.value)}
        >
          <option value="">Font…</option>
          {FONT_FAMILIES.map((f) => (
            <option key={f.family} value={f.family}>{f.label}</option>
          ))}
        </select>
        <select
          className="ed-select ed-select-size"
          value={fmt.fontSize}
          title="Font size"
          onChange={(e) => setFontSize(Number(e.target.value))}
        >
          <option value="">Size…</option>
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>{s}px</option>
          ))}
        </select>
        <span className="sep" />
        <ToolbarButton title="Bold" active={fmt.bold} onClick={() => exec('bold')}><BoldIcon /></ToolbarButton>
        <ToolbarButton title="Italic" active={fmt.italic} onClick={() => exec('italic')}><ItalicIcon /></ToolbarButton>
        <ToolbarButton title="Underline" active={fmt.underline} onClick={() => exec('underline')}><UnderlineIcon /></ToolbarButton>
        <ToolbarButton title="Strikethrough" active={fmt.strike} onClick={() => exec('strikeThrough')}><StrikethroughIcon /></ToolbarButton>
        <label className="ed-color" title="Text color">
          <TextColorIcon />
          <input type="color" value="#1c1d21" onChange={(e) => setTextColor(e.target.value)} />
        </label>
        <label className="ed-color" title="Highlight color">
          <HighlightIcon />
          <input type="color" value="#fff3a0" onChange={(e) => setHighlight(e.target.value)} />
        </label>
        <span className="sep" />
        <ToolbarButton title="Align left" active={fmt.align === 'left'} onClick={() => exec('justifyLeft')}><AlignLeftIcon /></ToolbarButton>
        <ToolbarButton title="Align center" active={fmt.align === 'center'} onClick={() => exec('justifyCenter')}><AlignCenterIcon /></ToolbarButton>
        <ToolbarButton title="Align right" active={fmt.align === 'right'} onClick={() => exec('justifyRight')}><AlignRightIcon /></ToolbarButton>
        <ToolbarButton title="Justify" active={fmt.align === 'justify'} onClick={() => exec('justifyFull')}><AlignJustifyIcon /></ToolbarButton>
        <span className="sep" />
        <select className="ed-select ed-select-tight" value="" title="Line spacing" onChange={(e) => e.target.value && setBlockStyle('lineHeight', e.target.value)}>
          <option value="">Line…</option>
          {LINE_SPACINGS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className="ed-select ed-select-tight" value="" title="Paragraph spacing" onChange={(e) => e.target.value !== '' && setBlockStyle('marginBottom', `${e.target.value}px`)}>
          <option value="">Paragraph…</option>
          {PARA_SPACINGS.map((s) => (
            <option key={s} value={s}>{s}px</option>
          ))}
        </select>
        <span className="sep" />
        <ToolbarButton title="Bulleted list" onClick={() => exec('insertUnorderedList')}><ListUlIcon /></ToolbarButton>
        <ToolbarButton title="Numbered list" onClick={() => exec('insertOrderedList')}><ListOlIcon /></ToolbarButton>
        <span className="sep" />
        <button type="button" className="ed-heading" title="Heading 1" onClick={() => setBlock('h1')}>H1</button>
        <button type="button" className="ed-heading" title="Heading 2" onClick={() => setBlock('h2')}>H2</button>
        <button type="button" className="ed-heading" title="Heading 3" onClick={() => setBlock('h3')}>H3</button>
        <ToolbarButton title="Paragraph" onClick={() => setBlock('p')}><ClearIcon /></ToolbarButton>
        <ToolbarButton title="Quote" onClick={() => setBlock('blockquote')}><QuoteIcon /></ToolbarButton>
        <ToolbarButton title="Insert link" onClick={promptLink}><LinkIcon /></ToolbarButton>
        <span className="sep" />
        <ToolbarButton title="Insert image" onClick={() => fileRef.current?.click()}><ImageIcon /></ToolbarButton>
        <ToolbarButton title="Add text box" onClick={insertTextBox}><TextBoxIcon /></ToolbarButton>
      </div>

      {mode === 'edit' ? (
        <div className="doc-canvas" ref={canvasRef}>
          <div
            ref={editorRef}
            className="doc-page editor-content"
            contentEditable
            suppressContentEditableWarning
            data-placeholder={placeholder}
            onInput={emitChange}
            onMouseDown={onPageMouseDown}
            onDoubleClick={onPageDoubleClick}
            onPaste={handlePaste}
            onBlur={emitChange}
            style={{ color: uploading ? 'var(--ink-mute)' : undefined }}
          />
          {selected && (
            <div className="doc-selection" ref={chromeRef}>
              <div className="doc-toolbar-pop">
                {selectedIsImage && (
                  <button type="button" onClick={replaceSelectedImage}>
                    <RefreshIcon /> Replace
                  </button>
                )}
                <button type="button" onClick={deleteSelectedObject}>
                  <TrashIcon /> Delete
                </button>
              </div>
              {HANDLES.map((dir) => (
                <div key={dir} className={`doc-handle ${dir}`} data-dir={dir} onPointerDown={startResize} />
              ))}
              <div className="doc-rotate" onPointerDown={startRotate} title="Rotate">
                <RotateIcon />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="reader-content doc-preview" style={{ border: '1px solid var(--line-strong)', borderRadius: '0 0 var(--radius-sm) var(--radius-sm)', background: 'var(--surface)', padding: '32px' }}>
          <div dangerouslySetInnerHTML={{ __html: value }} />
        </div>
      )}

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="small muted">
          {uploading ? 'Uploading image…' : 'Tip: paste an image, drag objects, resize with the handles.'}
        </span>
        <button
          type="button"
          className={mode === 'edit' ? 'btn btn-outline btn-sm' : 'btn btn-primary btn-sm'}
          onClick={() => setMode((m) => (m === 'edit' ? 'preview' : 'edit'))}
        >
          {mode === 'edit' ? <><EyeIcon /> Preview</> : <><EditIcon /> Edit</>}
        </button>
      </div>

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFilePicked} />
    </div>
  );
}
