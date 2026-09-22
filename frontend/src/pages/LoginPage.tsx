import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../api';
import { Button } from '../components/Button';
import { Field, TextInput } from '../components/Field';
import { useAuth } from '../hooks/useAuth';
import { AuthShell, EMAIL_RE } from './AuthShell';

export function LoginPage() {
  const { state, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/app/setup';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  if (state.status === 'authenticated') return <Navigate to={from} replace />;

  const emailErr = touched && !EMAIL_RE.test(email.trim()) ? 'Introdu o adresă de email validă.' : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!EMAIL_RE.test(email.trim()) || !password) return;
    setBusy(true);
    setError(null);
    try {
      await login({ email: email.trim(), password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? (err.status === 401 ? 'Email sau parolă greșită.' : err.detail) : 'Ceva n-a mers. Încearcă din nou.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Bine ai revenit"
      subtitle="Intră în contul instituției tale."
      footer={
        <>
          Nu ai cont?{' '}
          <Link to="/register" className="font-medium text-indigo-600 hover:underline">
            Creează unul
          </Link>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <Field label="Email" htmlFor="email" error={emailErr}>
          <TextInput id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} invalid={!!emailErr} placeholder="secretariat@universitate.md" autoFocus />
        </Field>
        <Field label="Parolă" htmlFor="password">
          <TextInput id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</p>}
        <Button type="submit" variant="primary" size="lg" loading={busy} className="mt-2 w-full">
          Intră
        </Button>
      </form>
    </AuthShell>
  );
}
