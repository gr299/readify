import { useCallback, useEffect, useRef, useState } from 'react';
import { XIcon, RefreshIcon, CropIcon } from './Icons.jsx';

const RATIOS = [
  { key: 'free', label: 'Free', value: null },
  { key: '16:9', label: '16:9', value: 16 / 9 },
  { key: '4:3', label: '4:3', value: 4 / 3 },
  { key: '3:2', label: '3:2', value: 3 / 2 },
  { key: '1:1', label: '1:1', value: 1 },
];

const MAX_OUTPUT = 1600;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

function extFor(file) {
  const mime = (file?.type || '').toLowerCase();
  if (mime === 'image/png' || mime === 'image/gif' || mime === 'image/svg+xml') return 'png';
  return 'jpg';
}

function mimeFor(file) {
  return extFor(file) === 'png' ? 'image/png' : 'image/jpeg';
}

export function ImageCropperModal({ open, file, initialRatio = null, onCancel, onApply }) {
  const viewportRef = useRef(null);
  const frameRef = useRef(null);
  const imgRef = useRef(null);
  const [image, setImage] = useState(null); // { url, w, h }
  const [ratioKey, setRatioKey] = useState('free');
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);
  const busyRef = useRef(false);
  const [applying, setApplying] = useState(false);

  const ratioValue = RATIOS.find((r) => r.key === ratioKey)?.value ?? null;

  useEffect(() => {
    if (!open || !file) {
      setImage(null);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage({ url, w: img.naturalWidth, h: img.naturalHeight });
      setZoom(MIN_ZOOM);
      setOffset({ x: 0, y: 0 });
      const key = RATIOS.find((r) => r.value !== null && Math.abs(r.value - (initialRatio || 0)) < 0.01)?.key;
      setRatioKey(initialRatio ? key || 'free' : 'free');
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [open, file]);

  const currentRatio = useCallback(() => {
    if (ratioValue) return ratioValue;
    if (image && image.w && image.h) return image.w / image.h;
    return 1;
  }, [ratioValue, image]);

  const measureFrame = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const vw = vp.clientWidth - 24;
    const vh = vp.clientHeight - 24;
    const ratio = currentRatio();
    let fw = Math.min(vw, 560);
    let fh = fw / ratio;
    if (fh > vh) {
      fh = vh;
      fw = fh * ratio;
    }
    setFrame({ w: Math.max(120, fw), h: Math.max(120, fh) });
  }, [currentRatio]);

  useEffect(() => {
    if (!open) return;
    measureFrame();
    const ro = new ResizeObserver(measureFrame);
    if (viewportRef.current) ro.observe(viewportRef.current);
    return () => ro.disconnect();
  }, [open, measureFrame]);

  const scale = frame.w && image ? Math.max(frame.w / image.w, frame.h / image.h) * zoom : 1;

  const clampOffset = useCallback(
    (x, y) => {
      const maxX = Math.max(0, (image.w * scale - frame.w) / 2);
      const maxY = Math.max(0, (image.h * scale - frame.h) / 2);
      return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
    },
    [image, frame, scale]
  );

  const handleZoom = (value) => {
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(value)));
    const factor = z / zoom;
    setZoom(z);
    setOffset((o) => clampOffset(o.x * factor, o.y * factor));
  };

  const reset = () => {
    setZoom(MIN_ZOOM);
    setOffset({ x: 0, y: 0 });
  };

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, ox: offset.x, oy: offset.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    const d = dragRef.current;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) d.moved = true;
    setOffset(clampOffset(d.ox + dx, d.oy + dy));
  };

  const onPointerUp = (e) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const applyCrop = () => {
    const imgEl = imgRef.current;
    const frameEl = frameRef.current;
    if (!imgEl || !frameEl || !image || !frame.w) return;
    if (applying) return;

    setApplying(true);
    const imgRect = imgEl.getBoundingClientRect();
    const frameRect = frameEl.getBoundingClientRect();
    const visualScale = imgRect.width / image.w;
    const sx = (frameRect.left - imgRect.left) / visualScale;
    const sy = (frameRect.top - imgRect.top) / visualScale;
    const sw = frameRect.width / visualScale;
    const sh = frameRect.height / visualScale;

    const outW = Math.max(100, Math.min(Math.round(sw), MAX_OUTPUT));
    const outH = Math.max(100, Math.round(sh * (outW / sw)));

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imgEl, sx, sy, sw, sh, 0, 0, outW, outH);

    const mime = mimeFor(file);
    canvas.toBlob(
      (blob) => {
        setApplying(false);
        if (!blob) return;
        const out = new File([blob], `cropped-${Date.now()}.${extFor(file)}`, { type: mime });
        onApply(out);
      },
      mime,
      0.9
    );
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !applying) onCancel();
    };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, applying, onCancel]);

  if (!open) return null;

  return (
    <div className="modal-overlay crop-overlay" onClick={() => !applying && onCancel()}>
      <div className="modal crop-modal" role="dialog" aria-modal="true" aria-label="Crop image" onClick={(e) => e.stopPropagation()}>
        <div className="crop-header">
          <h3>
            <CropIcon /> Crop image
          </h3>
          <button className="icon-btn" onClick={onCancel} disabled={applying} aria-label="Close cropper">
            <XIcon />
          </button>
        </div>

        <div className="crop-viewport" ref={viewportRef}>
          {image ? (
            <div className="crop-frame" ref={frameRef} style={{ width: frame.w, height: frame.h }}>
              <img
                ref={imgRef}
                src={image.url}
                alt="Crop preview"
                draggable={false}
                style={{
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})`,
                }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              />
            </div>
          ) : (
            <div className="crop-loading">Loading image…</div>
          )}
        </div>

        <div className="crop-controls">
          <div className="crop-ratios" role="group" aria-label="Aspect ratio">
            {RATIOS.map((r) => (
              <button
                key={r.key}
                className={`chip ${ratioKey === r.key ? 'active' : ''}`}
                onClick={() => {
                  setRatioKey(r.key);
                  setOffset({ x: 0, y: 0 });
                  setZoom(MIN_ZOOM);
                }}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="crop-zoom">
            <span className="small muted">Zoom</span>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(e) => handleZoom(e.target.value)}
              aria-label="Zoom"
            />
            <button className="icon-btn" onClick={reset} aria-label="Reset crop" title="Reset">
              <RefreshIcon />
            </button>
          </div>

          <p className="hint" style={{ marginTop: 2 }}>
            Drag the photo to position it. Choose a ratio, then apply.
          </p>
        </div>

        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onCancel} disabled={applying}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={applyCrop} disabled={applying || !image}>
            {applying ? 'Applying…' : 'Apply crop'}
          </button>
        </div>
      </div>
    </div>
  );
}
