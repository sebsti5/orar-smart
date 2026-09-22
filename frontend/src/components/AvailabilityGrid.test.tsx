import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AvailabilityGrid } from './AvailabilityGrid';
import { DEFAULT_SLOTS } from '../lib/setupDefaults';
import type { Matrix } from '../lib/availability';

function Harness() {
  const [m, setM] = useState<Matrix>([]);
  return (
    <>
      <AvailabilityGrid value={m} onChange={setM} days={5} slots={DEFAULT_SLOTS} />
      <output data-testid="m">{JSON.stringify(m)}</output>
    </>
  );
}

describe('AvailabilityGrid', () => {
  it('paints several cells with a click-and-drag', () => {
    render(<Harness />);
    const a = screen.getByLabelText('Lu 08:00: disponibil');
    const b = screen.getByLabelText('Lu 09:45: disponibil');
    const c = screen.getByLabelText('Lu 11:30: disponibil');
    fireEvent.mouseDown(a);
    fireEvent.mouseEnter(b);
    fireEvent.mouseEnter(c);
    fireEvent.mouseUp(window);
    expect(screen.getByText('32 / 35 perechi disponibile')).toBeInTheDocument();
    // after mouseup, hovering does nothing
    fireEvent.mouseEnter(screen.getByLabelText('Lu 13:30: disponibil'));
    expect(screen.getByText('32 / 35 perechi disponibile')).toBeInTheDocument();
  });

  it('applies presets', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Doar dimineața' }));
    expect(screen.getByText('15 / 35 perechi disponibile')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tot timpul' }));
    expect(screen.getByTestId('m').textContent).toBe('[]');
  });
});
