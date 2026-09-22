import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Logo } from '../components/Logo';
import { cx } from '../lib/colors';

function NavItem({ to, children }: { to: string; children: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cx(
          'rounded-lg px-3 py-1.5 text-sm font-medium transition',
          isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        )
      }
    >
      {children}
    </NavLink>
  );
}

export function AppLayout() {
  const { state, logout } = useAuth();
  const navigate = useNavigate();
  const name = state.status === 'authenticated' ? state.user.institution_name : '';
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur print:hidden">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4 sm:px-6">
          <Logo to="/app/setup" />
          <nav className="ml-4 flex items-center gap-1">
            <NavItem to="/app/setup">Configurare</NavItem>
            <NavItem to="/app/timetables">Orare</NavItem>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {name && (
              <span className="hidden max-w-[280px] truncate rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 sm:inline" title={name}>
                🏛 {name}
              </span>
            )}
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              Ieșire
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
