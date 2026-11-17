import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Award,
  Compass,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  Moon,
  Radio,
  Settings,
  ShieldCheck,
  Sun,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type { Role } from '@lumen/shared';
import { useAppSelector } from '../hooks';
import { api, useLogoutMutation } from '../api';
import { clearCredentials } from '../authSlice';
import { Avatar, Badge, Button, IconButton } from './ui';
import { BrandMark } from './SiteNav';
import { useTheme } from '../lib/theme';
import { cn } from '../lib/format';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}

const navFor: Record<Role, Array<{ heading: string; items: NavItem[] }>> = {
  student: [
    {
      heading: 'Learning',
      items: [
        { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
        { to: '/app/live', label: 'Live classes', icon: Radio },
        { to: '/app/certificates', label: 'Certificates', icon: Award },
      ],
    },
    {
      heading: 'Discover',
      items: [{ to: '/courses', label: 'Course catalog', icon: Compass }],
    },
    {
      heading: 'Account',
      items: [{ to: '/app/settings', label: 'Settings', icon: Settings }],
    },
  ],
  instructor: [
    {
      heading: 'Studio',
      items: [
        { to: '/teach', label: 'Overview', icon: Gauge, end: true },
        { to: '/teach/courses', label: 'Courses', icon: Library },
        { to: '/teach/students', label: 'Students', icon: Users },
        { to: '/teach/live', label: 'Live classes', icon: Radio },
      ],
    },
    {
      heading: 'Business',
      items: [{ to: '/teach/payouts', label: 'Revenue & payouts', icon: Wallet }],
    },
    {
      heading: 'Account',
      items: [{ to: '/app/settings', label: 'Profile', icon: Settings }],
    },
  ],
  admin: [
    {
      heading: 'Administration',
      items: [
        { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
        { to: '/admin/users', label: 'Users', icon: Users },
        { to: '/admin/courses', label: 'Courses', icon: Library },
        { to: '/admin/orders', label: 'Orders', icon: Wallet },
      ],
    },
    {
      heading: 'Platform',
      items: [{ to: '/courses', label: 'Public catalog', icon: Compass }],
    },
  ],
};

const roleLabel: Record<Role, string> = {
  student: 'Learner',
  instructor: 'Instructor',
  admin: 'Administrator',
};

export function AppShell() {
  const { user } = useAppSelector((state) => state.auth);
  const [logout] = useLogoutMutation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const [drawer, setDrawer] = useState(false);

  useEffect(() => setDrawer(false), [location.pathname]);

  if (!user) return null;
  const groups = navFor[user.role];

  const signOut = async () => {
    await logout();
    dispatch(clearCredentials());
    dispatch(api.util.resetApiState());
    navigate('/');
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center justify-between border-b border-line px-4">
        <Link to="/">
          <BrandMark />
        </Link>
        <IconButton label="Close menu" className="lg:hidden" onClick={() => setDrawer(false)}>
          <X size={16} />
        </IconButton>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.heading}>
            <p className="label-caps px-2 pb-1.5">{group.heading}</p>
            <nav className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to + item.label}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] transition-colors',
                      isActive
                        ? 'bg-[color-mix(in_oklab,var(--color-ember)_12%,transparent)] text-ink'
                        : 'text-muted hover:bg-[color-mix(in_oklab,var(--c-ink)_6%,transparent)] hover:text-ink',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon size={15} className={isActive ? 'text-ember' : 'text-faint group-hover:text-muted'} />
                      <span className="truncate">{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        ))}
      </div>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2.5 rounded-xl border border-line bg-surface p-2.5">
          <Avatar name={user.name} src={user.avatarUrl} size={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium text-ink">{user.name}</p>
            <p className="truncate font-mono text-[9.5px] uppercase tracking-[0.1em] text-faint">{roleLabel[user.role]}</p>
          </div>
          <IconButton label="Sign out" onClick={() => void signOut()}>
            <LogOut size={14} />
          </IconButton>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[236px] border-r border-line bg-[color-mix(in_oklab,var(--c-surface)_62%,var(--c-canvas))] lg:block">
        {sidebar}
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="absolute inset-0 bg-[#05070A]/70 backdrop-blur-sm" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-[264px] border-r border-line bg-surface animate-rise">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-[236px]">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-2">
            <IconButton label="Open menu" className="lg:hidden" onClick={() => setDrawer(true)}>
              <Menu size={17} />
            </IconButton>
            <Badge tone="neutral" className="gap-1">
              {user.role === 'student' ? <GraduationCap size={10} /> : <ShieldCheck size={10} />}
              {roleLabel[user.role]} workspace
            </Badge>
          </div>

          <div className="flex items-center gap-1">
            <Link to="/courses" className="hidden sm:block">
              <Button variant="ghost" size="sm" icon={<Compass size={13} />}>
                Browse catalog
              </Button>
            </Link>
            <IconButton label="Toggle theme" onClick={toggle}>
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </IconButton>
            <Link to="/app/settings" className="ml-1" aria-label="Profile settings">
              <Avatar name={user.name} src={user.avatarUrl} size={28} />
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-[1120px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
