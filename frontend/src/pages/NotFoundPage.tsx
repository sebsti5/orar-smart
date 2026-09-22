import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24">
      <EmptyState
        icon="🧭"
        title="Pagina nu există"
        description="Poate linkul e vechi sau a fost scris greșit."
        actions={
          <Link to="/" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
            Înapoi la început
          </Link>
        }
      />
    </div>
  );
}
