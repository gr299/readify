import { Link } from 'react-router-dom';

export function LogoMark({ size = 30 }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size, fontSize: size * 0.56 }}>
      <svg
        viewBox="0 0 24 24"
        width={size * 0.62}
        height={size * 0.62}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 5.5A5 5 0 0 0 8 4H3.5v15H8a5 5 0 0 1 4 1.9V5.5Z" />
        <path d="M12 5.5A5 5 0 0 1 16 4h4.5v15H16a5 5 0 0 0-4 1.9V5.5Z" />
        <path d="M12 5.5v15" />
      </svg>
    </span>
  );
}

export function Logo({ to = '/', size = 30 }) {
  return (
    <Link to={to} className="brand" aria-label="Readify home">
      <LogoMark size={size} />
      <span>Readify</span>
    </Link>
  );
}
