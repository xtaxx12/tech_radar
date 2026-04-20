import { useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';

export function UserMenu() {
  const { user, logout, favorites, rsvp } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!user) return null;

  const initials = getInitials(user.name ?? user.email);

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className={open ? 'user-menu-trigger user-menu-trigger-open' : 'user-menu-trigger'}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menú de usuario (${user.email})`}
      >
        {user.picture ? (
          <img src={user.picture} alt="" className="user-avatar" referrerPolicy="no-referrer" />
        ) : (
          <span className="user-avatar user-avatar-initials" aria-hidden="true">{initials}</span>
        )}
        <span className="user-menu-name">{user.name ?? user.email.split('@')[0]}</span>
        <span className="user-menu-chevron" aria-hidden="true">▾</span>
      </button>
      {open ? (
        <div className="user-menu-dropdown" role="menu">
          <div className="user-menu-header">
            <div className="user-menu-fullname">{user.name ?? 'Sin nombre'}</div>
            <div className="user-menu-email">{user.email}</div>
          </div>
          <div className="user-menu-stats">
            <div>
              <strong>{favorites.size}</strong>
              <span>Favoritos</span>
            </div>
            <div>
              <strong>{rsvp.size}</strong>
              <span>Asistiré</span>
            </div>
          </div>
          <button
            type="button"
            className="user-menu-item"
            onClick={() => {
              setOpen(false);
              void logout();
            }}
          >
            Cerrar sesión
          </button>
        </div>
      ) : null}
    </div>
  );
}

function getInitials(label: string): string {
  const clean = label.trim();
  if (!clean) return '?';
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}
