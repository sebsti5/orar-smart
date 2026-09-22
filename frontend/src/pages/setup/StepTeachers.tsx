import { useState } from 'react';
import type { Teacher } from '../../types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card, CardBody, CardHeader } from '../../components/Card';
import { DataGrid } from '../../components/DataGrid';
import type { GridColumn } from '../../components/DataGrid';
import { EmptyState } from '../../components/EmptyState';
import { LoadBar } from '../../components/LoadBar';
import { useToast } from '../../components/Toast';
import { countAvailable } from '../../lib/availability';
import { newId } from '../../lib/ids';
import { parseNumber } from '../../lib/paste';
import { teacherCapacity, teacherLoad } from '../../lib/planning';
import { TeacherDrawer } from './TeacherDrawer';
import type { StepProps } from './stepTypes';

export function StepTeachers({ setup, update }: StepProps) {
  const toast = useToast();
  const [openId, setOpenId] = useState<string | null>(null);
  const setTeachers = (teachers: Teacher[]) => update((s) => ({ ...s, teachers }));
  const days = setup.general.days_per_week;
  const slots = setup.general.slots.length;

  const columns: GridColumn<Teacher>[] = [
    {
      key: 'name',
      header: 'Nume',
      placeholder: 'Stanciu L.',
      hint: 'Așa cum apare în orar.',
      type: 'text',
      get: (t) => t.name,
      set: (t, v) => ({ ...t, name: String(v) }),
      validate: (t) => (t.name.trim() ? null : 'Numele lipsește.'),
    },
    { key: 'title', header: 'Titlu', placeholder: 'conf. univ., dr.', type: 'text', get: (t) => t.title, set: (t, v) => ({ ...t, title: String(v) }) },
    {
      key: 'max',
      header: 'Max perechi/săpt.',
      hint: 'Gol = fără limită.',
      type: 'number',
      width: '130px',
      placeholder: 'fără limită',
      get: (t) => t.max_pairs_per_week,
      set: (t, v) => {
        const n = Math.round(parseNumber(String(v)));
        return { ...t, max_pairs_per_week: Number.isFinite(n) && n > 0 ? Math.min(60, n) : null };
      },
    },
    {
      key: 'caps',
      header: 'Ce predă',
      type: 'custom',
      paste: false,
      get: () => '',
      set: (t) => t,
      render: (t) => (
        <button type="button" onClick={() => setOpenId(t.id)} className="text-left">
          {t.capabilities.length > 0 ? (
            <Badge className="bg-indigo-50 text-indigo-700">{t.capabilities.length} discipline</Badge>
          ) : (
            <Badge className="bg-amber-50 text-amber-700">nesetat</Badge>
          )}
        </button>
      ),
    },
    {
      key: 'avail',
      header: 'Disponibil',
      type: 'custom',
      paste: false,
      get: () => '',
      set: (t) => t,
      render: (t) => (
        <button type="button" onClick={() => setOpenId(t.id)} className="text-xs text-slate-500 hover:text-indigo-700">
          {t.availability.length === 0 ? 'tot timpul' : `${countAvailable(t.availability, days, slots)} / ${days * slots}`}
        </button>
      ),
    },
    {
      key: 'load',
      header: 'Încărcare',
      type: 'custom',
      paste: false,
      get: () => '',
      set: (t) => t,
      render: (t) => <LoadBar compact required={teacherLoad(t.id, setup)} capacity={teacherCapacity(t, setup)} />,
    },
  ];

  const makeTeacher = (_: number, current: Teacher[]): Teacher => ({
    id: newId('t', '', current.map((t) => t.id)),
    name: '',
    title: '',
    max_pairs_per_week: null,
    capabilities: [],
    availability: [],
  });

  const open = setup.teachers.find((t) => t.id === openId) ?? null;

  return (
    <Card>
      <CardHeader
        title="Profesori"
        description="Lista cadrelor didactice. Deschide „Detalii” ca să alegi ce discipline predă fiecare și când este disponibil."
        actions={<Badge>{setup.teachers.length} profesori</Badge>}
      />
      <CardBody>
        <DataGrid
          rows={setup.teachers}
          columns={columns}
          onChange={setTeachers}
          rowKey={(t) => t.id}
          addLabel="Adaugă profesor"
          makeRow={makeTeacher}
          pasteHint="Coloane: Nume · Titlu · Max perechi/săpt."
          onPasted={(a, u) => toast.success(`Lipire reușită: ${a} profesori noi${u ? `, ${u} actualizați` : ''}.`)}
          rowActions={(t) => (
            <Button size="sm" variant="ghost" onClick={() => setOpenId(t.id)}>
              Detalii →
            </Button>
          )}
          empty={
            <EmptyState
              icon="🧑‍🏫"
              title="Niciun profesor încă"
              description="Copiază lista din Excel (nume, titlu, maxim perechi) și lipește-o aici. Capacitățile le poți completa după — sau lasă „Completează automat” de la pasul 7 să aleagă."
              actions={<Button variant="primary" onClick={() => setTeachers([makeTeacher(0, [])])}>Adaugă primul profesor</Button>}
            />
          }
        />
      </CardBody>
      <TeacherDrawer
        teacher={open}
        setup={setup}
        onClose={() => setOpenId(null)}
        onChange={(t) => update((s) => ({ ...s, teachers: s.teachers.map((x) => (x.id === t.id ? t : x)) }))}
      />
    </Card>
  );
}
