import { EyeIcon, EyeOffIcon } from './Icons.jsx';

export function PasswordField({
  id,
  label,
  value,
  onChange,
  onBlur,
  visible,
  onToggle,
  placeholder,
  autoComplete,
  hint,
  error,
  toggleLabel,
  leadingIcon: LeadingIcon,
  labelAction,
}) {
  const auto =
    autoComplete ??
    (label === 'New password' || label === 'Confirm new password' ? 'new-password' : 'current-password');
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="field">
      {labelAction ? (
        <div className="label-row">
          <label htmlFor={id}>{label}</label>
          {labelAction}
        </div>
      ) : (
        <label htmlFor={id}>{label}</label>
      )}
      <div className={`password-field${LeadingIcon ? ' icon-input' : ''}`}>
        {LeadingIcon ? <LeadingIcon /> : null}
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          autoComplete={auto}
          required
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
        />
        <button
          type="button"
          className="password-toggle"
          aria-label={`${visible ? 'Hide' : 'Show'} ${(toggleLabel || label).toLowerCase()}`}
          aria-pressed={visible}
          onClick={onToggle}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {error ? <span className="error" id={errorId} role="alert">{error}</span> : null}
      {hint ? <span className="hint small muted" id={hintId}>{hint}</span> : null}
    </div>
  );
}
