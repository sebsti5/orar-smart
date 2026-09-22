import { Link } from 'react-router-dom';

export function LogoMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#4f46e5" />
      <rect x="7" y="8" width="8" height="7" rx="2" fill="#c7d2fe" />
      <rect x="17" y="8" width="8" height="7" rx="2" fill="#fff" />
      <rect x="7" y="17" width="18" height="7" rx="2" fill="#a5b4fc" />
    </svg>
  );
}

export function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2 font-semibold tracking-tight text-slate-900">
      <LogoMark />
      <span>Orar Smart</span>
    </Link>
  );
}
