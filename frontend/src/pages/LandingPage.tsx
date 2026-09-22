import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { useAuth } from '../hooks/useAuth';

const FEATURES = [
  { icon: '🧭', title: 'Un ghid prietenos', text: 'Opt pași simpli: orarul sunetelor, grupe, săli, profesori, plan. Lipești direct din Excel.' },
  { icon: '⚡', title: 'Orar generat în secunde', text: 'Fără suprapuneri de profesori, grupe sau săli. Cu cât mai puține ferestre, cu atât mai bine.' },
  { icon: '🖐', title: 'Ajustezi cu drag & drop', text: 'Muți o lecție și vezi imediat dacă apare vreun conflict.' },
  { icon: '🔗', title: 'Publici cu un link', text: 'Studenții și profesorii văd orarul pe telefon. Export Excel în formatul obișnuit.' },
];

function PreviewCell({ kind, subject, meta, span = 1 }: { kind: 'c' | 's' | 'l'; subject: string; meta: string; span?: number }) {
  const cls = kind === 'c' ? 'bg-indigo-50 border-indigo-200' : kind === 's' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200';
  return (
    <div className={`rounded-lg border px-2 py-1.5 text-[11px] leading-tight ${cls}`} style={{ gridColumn: `span ${span}` }}>
      <div className="font-semibold text-slate-800">{subject}</div>
      <div className="text-slate-500">{meta}</div>
    </div>
  );
}

export function LandingPage() {
  const { state } = useAuth();
  const authed = state.status === 'authenticated';
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/60 via-white to-white">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Logo />
        <div className="flex items-center gap-2">
          {authed ? (
            <Link to="/app/setup" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
              Deschide aplicația
            </Link>
          ) : (
            <>
              <Link to="/login" className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-white">
                Autentificare
              </Link>
              <Link to="/register" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500">
                Creează cont
              </Link>
            </>
          )}
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-16 pt-10 lg:grid-cols-2 lg:pt-20">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-indigo-700 shadow-soft ring-1 ring-indigo-100">
            ✨ Pentru universități · în limba română
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
            Orarul facultății, <span className="text-indigo-600">gata în câteva minute</span>.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
            Introduci datele o singură dată, cu un ghid care completează singur ce se poate ghici. Orar Smart
            generează un orar fără suprapuneri, cu cât mai puține ferestre — exact în formatul pe care studenții îl
            cunosc.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={authed ? '/app/setup' : '/register'} className="rounded-xl bg-indigo-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-indigo-500">
              Începe gratuit →
            </Link>
            <Link to="/login" className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-base font-medium text-slate-700 hover:bg-slate-50">
              Am deja cont
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-500">Vrei doar să încerci? După înregistrare apeși „Încarcă date demo”.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lift">
          <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">Luni</span> · anul I · TI
          </div>
          <div className="grid grid-cols-[60px_repeat(3,1fr)] gap-1.5 text-center">
            <div />
            {['TI-261', 'TI-262', 'TI-263'].map((g) => (
              <div key={g} className="rounded-md bg-slate-100 py-1 text-[11px] font-semibold text-slate-600">{g}</div>
            ))}
            <div className="py-2 text-[11px] text-slate-400">08:00</div>
            <PreviewCell kind="c" subject="c. Analiza matematică" meta="Stanciu L. · 3-611" span={3} />
            <div className="py-2 text-[11px] text-slate-400">09:45</div>
            <PreviewCell kind="s" subject="s. Programarea C" meta="Pavel T. · 3-114" />
            <PreviewCell kind="l" subject="l. Fizica" meta="sg.1 Rusu A. · 1-204" />
            <PreviewCell kind="s" subject="s. Matematica discretă" meta="Ceban M. · 3-116" />
            <div className="py-2 text-[11px] text-slate-400">11:30</div>
            <div className="col-span-3 grid grid-rows-2 gap-1">
              <PreviewCell kind="c" subject="c. Fizica · săpt. impară" meta="Rusu A. · 3-608" />
              <PreviewCell kind="c" subject="c. Engleza · săpt. pară" meta="Munteanu E. · 3-608" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-soft">
            <div className="text-2xl">{f.icon}</div>
            <h3 className="mt-3 font-semibold text-slate-900">{f.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">{f.text}</p>
          </div>
        ))}
      </section>
      <footer className="border-t border-slate-100 py-8 text-center text-xs text-slate-400">© {new Date().getFullYear()} Orar Smart</footer>
    </div>
  );
}
