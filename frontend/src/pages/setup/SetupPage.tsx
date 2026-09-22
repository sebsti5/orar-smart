import { useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiError, api } from '../../api';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { PageLoader } from '../../components/Spinner';
import { Stepper } from '../../components/Stepper';
import { useToast } from '../../components/Toast';
import { useSetupDraft } from '../../hooks/useSetupDraft';
import { STEPS, issuesByStep } from '../../lib/steps';
import { SaveIndicator } from './SaveIndicator';
import { StepIssues } from './StepIssues';
import type { StepProps } from './stepTypes';
import { StepGeneral } from './StepGeneral';
import { StepGroups } from './StepGroups';
import { StepRooms } from './StepRooms';
import { StepTeachers } from './StepTeachers';
import { StepPlan } from './StepPlan';
import { StepStreams } from './StepStreams';
import { StepAssign } from './StepAssign';
import { StepReview } from './StepReview';

const STEP_COMPONENTS: Record<number, ComponentType<StepProps>> = {
  1: StepGeneral,
  2: StepGroups,
  3: StepRooms,
  4: StepTeachers,
  5: StepPlan,
  6: StepStreams,
  7: StepAssign,
  8: StepReview,
};

function clampStep(raw: string | null): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= STEPS.length ? n : 1;
}

export function SetupPage() {
  const draft = useSetupDraft();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const step = clampStep(params.get('step'));
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);

  const byStep = useMemo(() => issuesByStep(draft.analysis?.issues ?? []), [draft.analysis]);
  const counts = useMemo(() => {
    const out: Record<number, { errors: number; warnings: number }> = {};
    for (const [k, list] of Object.entries(byStep)) {
      out[Number(k)] = {
        errors: list.filter((i) => i.severity === 'error').length,
        warnings: list.filter((i) => i.severity === 'warning').length,
      };
    }
    return out;
  }, [byStep]);

  const goTo = (n: number) => {
    setParams({ step: String(n) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const loadDemo = async () => {
    setDemoBusy(true);
    try {
      const res = await api.loadDemo();
      draft.replace(res.setup, res.analysis);
      toast.success('Datele demo au fost încărcate. Explorează pașii!');
      setDemoOpen(false);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.detail : 'Nu am putut încărca datele demo.');
    } finally {
      setDemoBusy(false);
    }
  };

  if (draft.loadError) {
    return (
      <EmptyState
        icon="🔌"
        title="Nu am putut încărca configurarea"
        description={draft.loadError}
        actions={<Button variant="primary" onClick={() => void draft.reload()}>Reîncearcă</Button>}
      />
    );
  }
  if (!draft.setup) return <PageLoader label="Încărcăm configurarea…" />;

  const setup = draft.setup;
  const isEmpty = setup.groups.length === 0 && setup.teachers.length === 0 && setup.subjects.length === 0;
  const Current = STEP_COMPONENTS[step];
  const def = STEPS[step - 1];

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="mb-3 flex items-center justify-between px-1">
          <h1 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Configurare</h1>
          <SaveIndicator state={draft.saveState} error={draft.saveError} onRetry={() => void draft.flush()} />
        </div>
        <Stepper steps={STEPS} current={step} onSelect={goTo} counts={counts} />
        <div className="mt-4 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 p-4">
          <p className="text-sm font-medium text-indigo-900">Vrei să vezi cum arată?</p>
          <p className="mt-1 text-xs text-indigo-800/70">Încarcă o facultate de exemplu (6 programe, ~14 grupe, ~35 profesori).</p>
          <Button size="sm" variant="soft" className="mt-3 w-full bg-white" onClick={() => (isEmpty ? void loadDemo() : setDemoOpen(true))} loading={demoBusy}>
            Încarcă date demo
          </Button>
        </div>
      </aside>

      <section className="min-w-0">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">Pasul {step} din {STEPS.length}</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{def.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{def.hint}</p>
          </div>
        </div>

        {step !== 8 && <StepIssues issues={byStep[step] ?? []} />}

        <Current setup={setup} update={draft.update} analysis={draft.analysis} stepIssues={byStep[step] ?? []} goTo={goTo} flush={draft.flush} />

        <Card className="mt-6 flex items-center justify-between px-5 py-3">
          <Button variant="ghost" disabled={step === 1} onClick={() => goTo(step - 1)}>
            ← Înapoi
          </Button>
          <span className="text-xs text-slate-400">Totul se salvează automat.</span>
          {step < STEPS.length ? (
            <Button variant="primary" onClick={() => goTo(step + 1)}>
              Continuă: {STEPS[step].title} →
            </Button>
          ) : (
            <span />
          )}
        </Card>
      </section>

      <Modal
        open={demoOpen}
        onClose={() => setDemoOpen(false)}
        title="Înlocuiești datele cu cele demo?"
        description="Configurarea curentă va fi înlocuită complet cu datele de exemplu."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDemoOpen(false)}>Anulează</Button>
            <Button variant="danger" loading={demoBusy} onClick={() => void loadDemo()}>Da, înlocuiește</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Orarele deja generate rămân neatinse.</p>
      </Modal>
    </div>
  );
}
