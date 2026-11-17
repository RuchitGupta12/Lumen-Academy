import { Link } from 'react-router-dom';
import { BrandMark } from './SiteNav';

const columns = [
  {
    title: 'Learn',
    links: [
      { label: 'Course catalog', to: '/courses' },
      { label: 'Live classes', to: '/live' },
      { label: 'My dashboard', to: '/app' },
      { label: 'Verify a certificate', to: '/verify' },
    ],
  },
  {
    title: 'Teach',
    links: [
      { label: 'Instructor studio', to: '/teach' },
      { label: 'Revenue & payouts', to: '/teach/payouts' },
      { label: 'Course authoring guide', to: '/teach/courses' },
    ],
  },
  {
    title: 'Platform',
    links: [
      { label: 'Architecture notes', to: '/' },
      { label: 'Admin console', to: '/admin' },
      { label: 'Sign in', to: '/login' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line bg-[color-mix(in_oklab,var(--c-surface)_55%,var(--c-canvas))]">
      <div className="mx-auto grid max-w-[1180px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-3">
          <BrandMark />
          <p className="max-w-[260px] text-[12px] leading-relaxed text-muted">
            A learning platform for practitioners. Studio-grade video, live critique, graded work and certificates
            that hold up to a reference check.
          </p>
          <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-faint">
            Built as a MERN reference implementation
          </p>
        </div>

        {columns.map((column) => (
          <div key={column.title}>
            <p className="label-caps mb-3">{column.title}</p>
            <ul className="space-y-2">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-[12px] text-muted transition-colors hover:text-ink"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <p className="font-mono text-[10px] text-faint">© {new Date().getFullYear()} Lumen Academy</p>
          <p className="font-mono text-[10px] text-faint">
            Payments run in test mode · video delivered over signed HLS
          </p>
        </div>
      </div>
    </footer>
  );
}
