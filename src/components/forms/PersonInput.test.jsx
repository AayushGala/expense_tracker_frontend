import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import PersonInput from './PersonInput';

function Harness({ initial = '', onChange = () => {} }) {
  const [value, setValue] = useState(initial);
  return (
    <PersonInput
      value={value}
      onChange={(v) => { setValue(v); onChange(v); }}
      people={['Aditi', 'Housekeeper', 'Janki']}
      placeholder="Person name"
    />
  );
}

describe('PersonInput', () => {
  it('lists everyone on focus and filters as you type', () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText('Person name');
    fireEvent.focus(input);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Aditi', 'Housekeeper', 'Janki']);
    fireEvent.change(input, { target: { value: 'ja' } });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Janki']);
  });

  it('picks a name with a click', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.focus(screen.getByPlaceholderText('Person name'));
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Janki' }));
    expect(onChange).toHaveBeenLastCalledWith('Janki');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('allows a new name and says it is new', () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText('Person name');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Riya' } });
    expect(screen.getByText(/New person:/)).toHaveTextContent('New person: Riya');
  });

  it('snaps a case-only match to the stored spelling on blur', () => {
    const onChange = vi.fn();
    render(<Harness initial="aditi" onChange={onChange} />);
    fireEvent.blur(screen.getByPlaceholderText('Person name'));
    expect(onChange).toHaveBeenLastCalledWith('Aditi');
  });
});
