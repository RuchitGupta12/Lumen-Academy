import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
  ShieldCheck,
  Sun,
  X,
} from 'lucide-react';
import { useAppSelector } from '../hooks';
import { useLogoutMutation } from '../api';
import { useDispatch } from 'react-redux';
import { clearCredentials } from '../authSlice';
import { api } from '../api';
import { Avatar, Button, IconButton } from './ui';
import { useTheme } from '../lib/theme';
import { cn } from '../lib/format';

export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
        <rect width="64" height="64" rx="15" fill="#141820" stroke="rgba(233,229,220,0.18)" />
        <path d="M22 14h7v27h13v7H22z" fill="#E9E5DC" />
        <circle cx="45" cy="20" r="5" fill="#FF6A3D" />
      </svg>
      <span className="flex flex-col leading-none">
        <span className="font-display text-[16px] font-semibold tracking-[-0.02em] text-ink">Lumen</span>
        <span className="mt-[3px] font-mono text-[7.5px] uppercase tracking-[0.26em] text-faint">Academy</span>
      </span>
    </span>
  );
}

const publicLinks = [
  { to: '/courses', label: 'Catalog' },
  { to: '/live', label: 'Live classes' },
  { to: '/verify', label: 'Verify a certificate' },
];

export function SiteNav() {
  const { user } = useAppSelector((state) => state.auth);
  const [logout] = useLogoutMutation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuOpen(false);
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const signOut = async () => {
    await logout();
    dispatch(clearCredentials());
    dispatch(api.util.resetApiState());
    navigate('/');
  };

  const dashboardPath =
    user?.role === 'admin' ? '/admin' : user?.role === 'instructor' ? '/teach' : '/app';

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-canvas/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1180px] items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-7">
          <Link to="/" aria-label="Lumen Academy home">
            <BrandMark />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {publicLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors',
                    isActive ? 'text-ink' : 'text-muted hover:text-ink',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            to="/courses"
            className="hidden h-8 items-center gap-2 rounded-lg border border-line px-2.5 text-[11.5px] text-faint transition-colors hover:border-line-strong hover:text-muted sm:flex"
          >
            <Search size={12} />
            Search courses
            <kbd className="ml-2 rounded border border-line px-1 font-mono text-[9.5px]">/</kbd>
          </Link>

          <IconButton label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} onClick={toggle}>
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </IconButton>

          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((open) => !open)}
                className="flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pl-1 pr-2 transition-colors hover:border-line-strong"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <Avatar name={user.name} src={user.avatarUrl} size={26} />
                <span className="hidden text-[12px] text-ink sm:block">{user.name.split(' ')[0]}</span>
                <ChevronDown size={12} className="text-faint" />
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+8px)] w-56 overflow-hidden rounded-xl border border-line-strong bg-surface p-1 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)] animate-fade"
                >
                  <div className="px-2.5 py-2">
                    <p className="truncate text-[12.5px] font-medium text-ink">{user.name}</p>
                    <p className="truncate text-[11px] text-faint">{user.email}</p>
                    <span className="mt-1.5 inline-block rounded-full border border-line px-1.5 py-[1px] font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                      {user.role}
                    </span>
                  </div>
                  <div className="my-1 h-px bg-line" />
                  <Link
                    to={dashboardPath}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] text-muted transition-colors hover:bg-raised hover:text-ink"
                  >
                    <LayoutDashboard size={14} /> Dashboard
                  </Link>
                  <Link
                    to="/verify"
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] text-muted transition-colors hover:bg-raised hover:text-ink"
                  >
                    <ShieldCheck size={14} /> Verify certificate
                  </Link>
                  <button
                    onClick={() => void signOut()}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] text-muted transition-colors hover:bg-raised hover:text-danger"
                  >
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden items-center gap-1.5 sm:flex">
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </Link>
              <Link to="/register">
                <Button variant="primary" size="sm">
                  Start learning
                </Button>
              </Link>
            </div>
          )}

          <IconButton label="Menu" className="md:hidden" onClick={() => setMobileOpen((open) => !open)}>
            {mobileOpen ? <X size={17} /> : <Menu size={17} />}
          </IconButton>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-line bg-surface px-4 py-3 md:hidden">
          <nav className="flex flex-col">
            {publicLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className="rounded-lg px-2 py-2.5 text-[13px] text-muted hover:bg-raised hover:text-ink"
              >
                {link.label}
              </NavLink>
            ))}
            {!user && (
              <div className="mt-2 flex gap-2 border-t border-line pt-3">
                <Link to="/login" className="flex-1">
                  <Button variant="secondary" size="sm" block>
                    Sign in
                  </Button>
                </Link>
                <Link to="/register" className="flex-1">
                  <Button variant="primary" size="sm" block>
                    Create account
                  </Button>
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
