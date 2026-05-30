import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CategoryFilter from './CategoryFilter';

// Regression: category IDs round-trip through the URL as strings while
// category.id is a number. The filter must compare them as strings so the
// checkbox reflects selection and a click toggles off (instead of re-adding).
const CATEGORIES = [
  { id: 1, name: 'Food', type: 'expense', parent: null },
  { id: 2, name: 'Groceries', type: 'expense', parent: 1 },
];

describe('CategoryFilter string/number id matching', () => {
  it('treats a string-valued selection as selected (label + toggle off)', () => {
    const onChange = vi.fn();
    // value comes from the URL as a string, category.id is a number.
    render(<CategoryFilter categories={CATEGORIES} value={['2']} onChange={onChange} />);

    // Single selection resolves the name despite the string/number mismatch.
    expect(screen.getByText('Groceries')).toBeInTheDocument();

    // Open the menu and click the already-selected child.
    fireEvent.mouseDown(screen.getByRole('button', { name: /Groceries/i }));
    const rows = screen.getAllByText('Groceries');
    fireEvent.mouseDown(rows[rows.length - 1]);

    // It should toggle OFF (empty), not re-add a duplicate.
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('adds a child when not selected', () => {
    const onChange = vi.fn();
    render(<CategoryFilter categories={CATEGORIES} value={[]} onChange={onChange} />);

    fireEvent.mouseDown(screen.getByRole('button', { name: /Category/i }));
    fireEvent.mouseDown(screen.getByText('Groceries'));

    expect(onChange).toHaveBeenCalledWith([2]);
  });
});
