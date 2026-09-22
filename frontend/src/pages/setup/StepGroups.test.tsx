import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../components/Toast';
import { fixtureSetup } from '../../dev/fixtures';
import type { InstitutionSetup } from '../../types';
import { StepGroups } from './StepGroups';

function Harness() {
  const [setup, setSetup] = useState<InstitutionSetup>(() => ({ ...fixtureSetup(), groups: [] }));
  return (
    <ToastProvider>
      <StepGroups setup={setup} update={(fn) => setSetup((s) => fn(s))} analysis={null} stepIssues={[]} goTo={() => undefined} flush={async () => true} />
      <output data-testid="groups">{JSON.stringify(setup.groups.map((g) => [g.name, g.program_id, g.year]))}</output>
      <output data-testid="programs">{setup.programs.map((p) => p.abbreviation).join(',')}</output>
    </ToastProvider>
  );
}

describe('StepGroups', () => {
  it('auto-detects program and year when typing a group name', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Adaugă una câte una' }));
    fireEvent.change(screen.getByPlaceholderText('TI-251'), { target: { value: 'si-241' } });
    expect(screen.getByTestId('groups').textContent).toBe('[["SI-241","p_si",3]]');
  });

  it('bulk-adds groups with UTM names', () => {
    render(<Harness />);
    fireEvent.click(screen.getAllByRole('button', { name: /Adaugă grupe în bloc/ })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Adaugă 4 grupe' }));
    expect(screen.getByTestId('groups').textContent).toBe(
      '[["TI-261","p_ti",1],["TI-262","p_ti",1],["TI-263","p_ti",1],["TI-264","p_ti",1]]',
    );
  });

  it('creates a missing program from a pasted group list', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Adaugă una câte una' }));
    fireEvent.paste(screen.getByPlaceholderText('TI-251'), { clipboardData: { getData: () => 'RM-261\nRM-262' } });
    expect(screen.getByTestId('programs').textContent).toBe('TI,SI,RM');
    expect(JSON.parse(screen.getByTestId('groups').textContent ?? '[]')).toHaveLength(2);
  });

  it('suggests the program abbreviation from its name', () => {
    render(<Harness />);
    const inputs = screen.getAllByPlaceholderText('Tehnologia Informației');
    fireEvent.change(inputs[0], { target: { value: 'Robotică și Mecatronică' } });
    expect(screen.getByTestId('programs').textContent).toBe('RM,SI');
  });
});
