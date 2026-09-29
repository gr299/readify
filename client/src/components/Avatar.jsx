export function Avatar({ user, size = '' }) {
  const cls = size ? `avatar avatar-${size}` : 'avatar';
  if (user?.avatar) {
    return <img className={cls} src={user.avatar} alt={user?.name || 'user'} loading="lazy" />;
  }
  return (
    <div
      className={cls}
      style={{ display: 'grid', placeItems: 'center', fontWeight: 700, color: 'var(--primary)' }}
    >
      {(user?.name || 'U').slice(0, 1).toUpperCase()}
    </div>
  );
}
