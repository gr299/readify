import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SearchIcon } from './Icons.jsx';

export function SearchBar({ placeholder = 'Search articles, topics, authors…', initial = '', large = false }) {
  const [value, setValue] = useState(initial);
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const submit = (e) => {
    e.preventDefault();
    const q = value.trim();
    const next = new URLSearchParams(params);
    if (q) next.set('q', q);
    else next.delete('q');
    next.set('sort', next.get('sort') || 'latest');
    navigate(`/discover?${next.toString()}`);
  };

  return (
    <form className="searchbar" onSubmit={submit} role="search">
      <SearchIcon style={{ fontSize: '1.1rem', color: 'var(--ink-mute)' }} />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label="Search"
        style={large ? { fontSize: '1.05rem', padding: '6px 0' } : undefined}
      />
      <button type="submit" className="btn btn-primary btn-sm">
        Search
      </button>
    </form>
  );
}
