import { Avatar } from './Avatar.jsx';
import { STATUS_LABELS } from '../api.js';

export function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status] || status}</span>;
}

export function RoleBadge({ role }) {
  return <span className={`badge badge-${role}`}>{role}</span>;
}
