import { useEffect, useRef } from 'react';

export function ConfirmationModal({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'danger', onConfirm, onCancel, busy, children }) {
  const modalRef = useRef(null);
  const lastFocused = useRef(null);
  const onCancelRef = useRef(onCancel);
  const busyRef = useRef(busy);
  onCancelRef.current = onCancel;
  busyRef.current = busy;

  useEffect(() => {
    if (!open) return;
    lastFocused.current = document.activeElement;
    const node = modalRef.current;
    const first = node && node.querySelector('button:not([disabled]), input:not([disabled]), select, textarea, a[href]');
    if (first && typeof first.focus === 'function') first.focus();
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !busyRef.current && onCancelRef.current) onCancelRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) return;
    const el = lastFocused.current;
    if (el && typeof el.focus === 'function') el.focus();
    lastFocused.current = null;
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={busy ? undefined : onCancel}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={modalRef} onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        {children}
        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
