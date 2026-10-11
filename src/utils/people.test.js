import { describe, it, expect } from 'vitest';
import { groupByPerson, balanceOf, balanceSentence } from './people';
import { D } from './money';

const rows = [
  { id: 1, person_name: 'Aditi', amount: '-1000', transaction_date: '2026-10-01' },
  { id: 2, person_name: 'aditi ', amount: '700', transaction_date: '2026-10-02' },
  { id: 3, person_name: 'Aditi', amount: '500', transaction_date: '2026-10-03' },
  { id: 4, person_name: 'Janki', amount: '200', transaction_date: '2026-10-01' },
];

describe('groupByPerson', () => {
  it('nets each person into one balance, case-insensitively', () => {
    const people = groupByPerson(rows);
    const aditi = people.find((p) => p.key === 'aditi');
    expect(aditi.balance.toString()).toBe('200');
    expect(aditi.items.map((i) => i.balanceAfter.toString())).toEqual(['-1000', '-300', '200']);
    expect(people.find((p) => p.key === 'janki').balance.toString()).toBe('200');
  });
});

describe('balanceOf', () => {
  it('sums one person, and is zero for a new name', () => {
    expect(balanceOf(rows, ' ADITI').toString()).toBe('200');
    expect(balanceOf(rows, 'Nobody').toString()).toBe('0');
  });
});

describe('groupByPerson order', () => {
  it('orders same-day movements by transaction, so an edit keeps its place', () => {
    const [p] = groupByPerson([
      { id: 9, transaction: 2, person_name: 'A', amount: '250', transaction_date: '2026-10-11' },
      { id: 3, transaction: 5, person_name: 'A', amount: '100', transaction_date: '2026-10-11' },
    ]);
    expect(p.items.map((i) => i.transaction)).toEqual([2, 5]);
  });
});

describe('balanceSentence', () => {
  it('reads naturally either way', () => {
    expect(balanceSentence('Aditi', D(200))).toBe('Aditi owes you ₹200.00.');
    expect(balanceSentence('Aditi', D(-300))).toBe('You owe Aditi ₹300.00.');
    expect(balanceSentence('Aditi', D(0))).toBe('No balance with Aditi.');
  });
});
