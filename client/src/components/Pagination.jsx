export function Pagination({ page, totalPages, onChange }) {
  if (!totalPages || totalPages <= 1) return null;
  const pages = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <nav className="pagination" aria-label="Pagination">
      <button disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
        ‹
      </button>
      {start > 1 && (
        <>
          <button onClick={() => onChange(1)}>1</button>
          {start > 2 && <span className="muted small">…</span>}
        </>
      )}
      {pages.map((p) => (
        <button key={p} className={p === page ? 'active' : ''} onClick={() => onChange(p)}>
          {p}
        </button>
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="muted small">…</span>}
          <button onClick={() => onChange(totalPages)}>{totalPages}</button>
        </>
      )}
      <button disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="Next page">
        ›
      </button>
    </nav>
  );
}
