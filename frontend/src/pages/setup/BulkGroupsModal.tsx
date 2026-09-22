import { useEffect, useState } from 'react';
import type { Group, InstitutionSetup } from '../../types';
import { Button } from '../../components/Button';
import { Field, NumberStepper, Select } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { Chip } from '../../components/Badge';
import { admissionYYForStudyYear, nextGroupNames } from '../../lib/groupName';
import { newId } from '../../lib/ids';

export function BulkGroupsModal({
  open,
  onClose,
  setup,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  setup: InstitutionSetup;
  onAdd: (groups: Group[]) => void;
}) {
  const [programId, setProgramId] = useState(setup.programs[0]?.id ?? '');
  const [year, setYear] = useState(1);
  const [count, setCount] = useState(4);
  const [students, setStudents] = useState(25);
  const [subgroups, setSubgroups] = useState(2);

  useEffect(() => {
    if (!setup.programs.some((p) => p.id === programId)) setProgramId(setup.programs[0]?.id ?? '');
  }, [setup.programs, programId]);

  const program = setup.programs.find((p) => p.id === programId);
  const names = program
    ? nextGroupNames(program.abbreviation, year, count, setup.general.academic_year, setup.groups.map((g) => g.name))
    : [];

  const submit = () => {
    if (!program) return;
    const taken = setup.groups.map((g) => g.id);
    const groups = names.map((name) => {
      const id = newId('g', name, taken);
      taken.push(id);
      return { id, name, program_id: program.id, year, students, subgroups };
    });
    onAdd(groups);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adaugă grupe în bloc"
      description="Alegi programul, anul și câte grupe — numele se generează după modelul UTM."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Anulează</Button>
          <Button variant="primary" onClick={submit} disabled={!program || names.length === 0}>
            Adaugă {names.length} grupe
          </Button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Program" className="sm:col-span-2">
          <Select value={programId} onChange={(e) => setProgramId(e.target.value)}>
            {setup.programs.map((p) => (
              <option key={p.id} value={p.id}>{p.abbreviation} · {p.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Anul de studiu" hint={`În ${setup.general.academic_year}, anul ${year} = admiși în 20${String(admissionYYForStudyYear(year, setup.general.academic_year)).padStart(2, '0')}.`}>
          <NumberStepper value={year} min={1} max={8} onChange={setYear} ariaLabel="Anul de studiu" />
        </Field>
        <Field label="Câte grupe">
          <NumberStepper value={count} min={1} max={20} onChange={setCount} ariaLabel="Număr de grupe" />
        </Field>
        <Field label="Studenți / grupă" hint="Poți ajusta fiecare grupă după.">
          <NumberStepper value={students} min={1} max={200} step={1} onChange={setStudents} ariaLabel="Studenți pe grupă" />
        </Field>
        <Field label="Subgrupe" hint="Pentru laboratoare.">
          <NumberStepper value={subgroups} min={1} max={4} onChange={setSubgroups} ariaLabel="Subgrupe" />
        </Field>
      </div>
      <div className="mt-5 rounded-xl bg-slate-50 p-3">
        <p className="mb-2 text-xs font-medium text-slate-500">Previzualizare</p>
        <div className="flex flex-wrap gap-1.5">
          {names.map((n) => (
            <Chip key={n} className="border-indigo-200 bg-indigo-50 font-semibold text-indigo-700">{n}</Chip>
          ))}
          {names.length === 0 && <span className="text-xs text-slate-400">Alege un program.</span>}
        </div>
      </div>
    </Modal>
  );
}
