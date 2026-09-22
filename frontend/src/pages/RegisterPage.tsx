import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ApiError } from '../api';
import { Button } from '../components/Button';
import { Field, TextInput } from '../components/Field';
import { useAuth } from '../hooks/useAuth';
import { AuthShell, EMAIL_RE } from './AuthShell';

export const MIN_PASSWORD = 8;

export function RegisterPage() {
  const { state, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ institution_name: '', email: '', password: '' });
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (state.status === 'authenticated') return <Navigate to="/app/setup" replace />;

  const errs = {
    institution_name: form.institution_name.trim().length < 2 ? 'Scrie numele instituției.' : null,
    email: !EMAIL_RE.test(form.email.trim()) ? 'Introdu o adresă de email validă.' : null,
    password: form.password.length < MIN_PASSWORD ? `Parola trebuie să aibă cel puțin ${MIN_PASSWORD} caractere.` : null,
  };
  const valid = !errs.institution_name && !errs.email && !errs.password;
  const show = (k: keyof typeof errs) => (touched ? errs[k] : null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await register({ ...form, email: form.email.trim(), institution_name: form.institution_name.trim() });
      navigate('/app/setup', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Ceva n-a mers. Încearcă din nou.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Creează un cont"
      subtitle="Un cont per instituție. Durează 30 de secunde."
      footer={
        <>
          Ai deja cont?{' '}
          <Link to="/login" className="font-medium text-indigo-600 hover:underline">
            Autentifică-te
          </Link>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <Field label="Instituția" htmlFor="inst" error={show('institution_name')} hint="Ex.: Universitatea Tehnică a Moldovei, FCIM">
          <TextInput id="inst" value={form.institution_name} onChange={(e) => setForm({ ...form, institution_name: e.target.value })} invalid={!!show('institution_name')} autoFocus />
        </Field>
        <Field label="Email" htmlFor="email" error={show('email')}>
          <TextInput id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} invalid={!!show('email')} />
        </Field>
        <Field label="Parolă" htmlFor="password" error={show('password')} hint={`Minimum ${MIN_PASSWORD} caractere.`}>
          <TextInput id="password" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} invalid={!!show('password')} />
        </Field>
        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</p>}
        <Button type="submit" variant="primary" size="lg" loading={busy} className="mt-2 w-full">
          Creează contul
        </Button>
      </form>
    </AuthShell>
  );
}
