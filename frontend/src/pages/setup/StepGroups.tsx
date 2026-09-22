import { useState } from 'react';
import type { Group, InstitutionSetup, Program } from '../../types';
import { Button } from '../../components/Button';
import { Card, CardBody, CardHeader } from '../../components/Card';
import { DataGrid } from '../../components/DataGrid';
import type { GridColumn } from '../../components/DataGrid';
import { EmptyState } from '../../components/EmptyState';
import { useToast } from '../../components/Toast';
import { suggestAbbreviation } from '../../lib/groupName';
import { applyGroupName, reconcileGroups } from '../../lib/groupsReconcile';
import { newId } from '../../lib/ids';
import { parseNumber } from '../../lib/paste';
import { groupCapacity, groupWeeklyPairs } from '../../lib/planning';
import { BulkGroupsModal } from './BulkGroupsModal';
import type { StepProps } from './stepTypes';

function intIn(raw: string, min: number, max: number, fallback: number): number {
  const n = Math.round(parseNumber(raw));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function programColumns(): GridColumn<Program>[] {
  return [
    {
      key: 'name',
      header: 'Denumire program',
      placeholder: 'Tehnologia Informației',
      type: 'text',
      width: '60%',
      get: (p) => p.name,
      set: (p, v) => {
        const name = String(v);
        const autoAbbr = !p.abbreviation || p.abbreviation === suggestAbbreviation(p.name);
        return { ...p, name, abbreviation: autoAbbr ? suggestAbbreviation(name) : p.abbreviation };
      },
      validate: (p) => (p.name.trim() ? null : 'Scrie denumirea.'),
    },
    {
      key: 'abbreviation',
      header: 'Abreviere',
      hint: 'Prefixul grupelor: TI → TI-251. Se propune automat din inițiale.',
      placeholder: 'TI',
      type: 'text',
      get: (p) => p.abbreviation,
      set: (p, v) => ({ ...p, abbreviation: String(v).toUpperCase().trim() }),
      validate: (p) => (p.abbreviation.trim() ? null : 'Abrevierea lipsește.'),
    },
  ];
}

function groupColumns(setup: InstitutionSetup): GridColumn<Group>[] {
  const programs = setup.programs;
  const ay = setup.general.academic_year;
  return [
    {
      key: 'name',
      header: 'Grupa',
      hint: 'Scrie „TI-251” și completăm singuri programul și anul.',
      placeholder: 'TI-251',
      type: 'text',
      get: (g) => g.name,
      set: (g, v) => applyGroupName(g, String(v).toUpperCase(), programs, ay),
      validate: (g) => (g.name.trim() ? null : 'Numele lipsește.'),
    },
    {
      key: 'program',
      header: 'Program',
      type: 'select',
      placeholder: '— alege —',
      options: programs.map((p) => ({ value: p.id, label: `${p.abbreviation} · ${p.name}` })),
      get: (g) => g.program_id,
      set: (g, v) => ({ ...g, program_id: String(v) }),
      validate: (g) => (programs.some((p) => p.id === g.program_id) ? null : 'Alege programul.'),
      paste: (g, raw) => {
        const r = raw.trim().toUpperCase();
        const hit = programs.find((p) => p.abbreviation.toUpperCase() === r || p.name.toUpperCase() === r);
        return hit ? { ...g, program_id: hit.id } : g;
      },
    },
    { key: 'year', header: 'Anul', hint: 'Anul de studiu (1–8).', type: 'number', width: '80px', get: (g) => g.year, set: (g, v) => ({ ...g, year: intIn(String(v), 1, 8, g.year) }) },
    { key: 'students', header: 'Studenți', type: 'number', width: '100px', get: (g) => g.students, set: (g, v) => ({ ...g, students: intIn(String(v), 1, 1000, g.students) }) },
    {
      key: 'subgroups',
      header: 'Subgrupe',
      hint: 'Laboratoarele se țin separat pe subgrupe (1–4).',
      type: 'number',
      width: '100px',
      get: (g) => g.subgroups,
      set: (g, v) => ({ ...g, subgroups: intIn(String(v), 1, 4, g.subgroups) }),
    },
  ];
}

export function StepGroups({ setup, update }: StepProps) {
  const toast = useToast();
  const [bulkOpen, setBulkOpen] = useState(false);

  const setPrograms = (programs: Program[]) => update((s) => ({ ...s, programs }));
  const setGroups = (groups: Group[]) => {
    const r = reconcileGroups(groups, setup.programs, setup.general.academic_year);
    if (r.created.length > 0) {
      toast.info(`Am creat programul ${r.created.map((p) => p.abbreviation).join(', ')} — completează-i denumirea.`);
    }
    update((s) => ({ ...s, groups: r.groups, programs: r.programs }));
  };

  const makeGroup = (_: number, current: Group[]): Group => {
    const last = current[current.length - 1];
    return {
      id: newId('g', '', current.map((g) => g.id)),
      name: '',
      program_id: last?.program_id ?? setup.programs[0]?.id ?? '',
      year: last?.year ?? 1,
      students: last?.students ?? 25,
      subgroups: last?.subgroups ?? 2,
    };
  };

  const cap = groupCapacity(setup);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader title="Programe de studii" description="Specialitățile facultății. Abrevierea devine prefixul grupelor." />
        <CardBody>
          <DataGrid
            rows={setup.programs}
            columns={programColumns()}
            onChange={setPrograms}
            rowKey={(p) => p.id}
            addLabel="Adaugă program"
            makeRow={() => ({ id: newId('p', '', setup.programs.map((p) => p.id)), name: '', abbreviation: '' })}
            onPasted={(a) => a && toast.success(`Am adăugat ${a} programe.`)}
            empty={
              <EmptyState
                icon="🎓"
                title="Niciun program încă"
                description="Adaugă programele de studii (ex.: Tehnologia Informației — TI) sau scrie direct grupele mai jos: programul se creează singur din numele grupei."
                actions={
                  <Button variant="primary" onClick={() => setPrograms([{ id: newId('p', '', []), name: '', abbreviation: '' }])}>
                    Adaugă primul program
                  </Button>
                }
              />
            }
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Grupe"
          description={`Scrie sau lipește nume ca „TI-251” — programul și anul se completează automat din anul universitar ${setup.general.academic_year}.`}
          actions={
            <Button size="sm" variant="primary" onClick={() => setBulkOpen(true)} disabled={setup.programs.length === 0}>
              ⚡ Adaugă grupe în bloc
            </Button>
          }
        />
        <CardBody>
          <DataGrid
            rows={setup.groups}
            columns={groupColumns(setup)}
            onChange={setGroups}
            rowKey={(g) => g.id}
            addLabel="Adaugă grupă"
            makeRow={makeGroup}
            rowError={(g) => {
              const pairs = groupWeeklyPairs(g, setup.subjects);
              return pairs > cap ? `${pairs} perechi/săpt. > capacitatea de ${cap}` : null;
            }}
            onPasted={(a, u) => toast.success(`Lipire reușită: ${a} grupe noi${u ? `, ${u} actualizate` : ''}.`)}
            empty={
              <EmptyState
                icon="👥"
                title="Nicio grupă încă"
                description="Lipește lista din Excel (nume, program, an, studenți, subgrupe) sau generează rapid grupele unui an."
                actions={
                  <>
                    <Button variant="primary" onClick={() => setBulkOpen(true)} disabled={setup.programs.length === 0}>
                      ⚡ Adaugă grupe în bloc
                    </Button>
                    <Button onClick={() => setGroups([makeGroup(0, [])])}>Adaugă una câte una</Button>
                  </>
                }
              />
            }
          />
        </CardBody>
      </Card>

      <BulkGroupsModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        setup={setup}
        onAdd={(groups) => {
          setGroups([...setup.groups, ...groups]);
          toast.success(`Am adăugat ${groups.length} grupe: ${groups.map((g) => g.name).join(', ')}.`);
        }}
      />
    </div>
  );
}
