import { D, ZERO } from './money';
import { formatINR } from './formatters';

// Each person has one running balance with the household: positive means
// they owe us, negative means we owe them. A receivable row is one movement
// in it (split +, money or a payment from them -, payout to them +).

export function personKey(name) {
  return (name ?? '').trim().toLowerCase();
}

// One entry per person (names match case-insensitively), movements oldest
// first, each with the balance after it.
export function groupByPerson(receivables) {
  const people = new Map();
  for (const r of receivables ?? []) {
    const key = personKey(r.person_name);
    if (!key) continue;
    if (!people.has(key)) people.set(key, { key, name: r.person_name.trim(), items: [] });
    people.get(key).items.push(r);
  }
  return [...people.values()].map((p) => {
    // By transaction, not row: editing a transaction rewrites its row.
    p.items.sort((a, b) => (a.transaction_date ?? '').localeCompare(b.transaction_date ?? '')
      || a.transaction - b.transaction || a.id - b.id);
    let running = ZERO;
    p.items = p.items.map((item) => {
      running = running.plus(D(item.amount));
      return { ...item, balanceAfter: running };
    });
    p.balance = running;
    return p;
  });
}

export function balanceOf(receivables, name) {
  const key = personKey(name);
  if (!key) return ZERO;
  return (receivables ?? [])
    .filter((r) => personKey(r.person_name) === key)
    .reduce((total, r) => total.plus(D(r.amount)), ZERO);
}

// "Aditi owes you ₹200.00." / "You owe Aditi ₹300.00." / "No balance with Aditi."
export function balanceSentence(name, balance) {
  if (balance.gt(0)) return `${name} owes you ${formatINR(balance)}.`;
  if (balance.lt(0)) return `You owe ${name} ${formatINR(balance.abs())}.`;
  return `No balance with ${name}.`;
}

// How a movement with a person happened. 'in' lowers the balance (they gave
// you money, or paid for you), 'out' raises it (you gave them money, or paid
// for them), a write-off forgives it either way.
export const SETTLE_MODES = [
  {
    value: 'money', group: 'in', label: 'Money received', title: 'Money received',
    help: 'They sent money into one of your accounts. Past what they owe, it becomes money you owe them.',
  },
  {
    value: 'paid_for_me', group: 'in', label: 'Paid for me', title: 'They paid for something of yours',
    help: 'It counts as your spending. It lowers what they owe, or adds to what you owe them.',
  },
  {
    value: 'money_out', group: 'out', label: 'Money sent', title: 'Money sent',
    help: 'You sent them money: paying back what you owe, or lending.',
  },
  {
    value: 'paid_for_them', group: 'out', label: 'Paid for them', title: 'You paid for something of theirs',
    help: 'It is not your spending. It adds to what they owe, or lowers what you owe them.',
  },
  {
    value: 'write_off', group: 'off', label: 'Write off', title: 'Write off',
    help: 'Forgive the balance. It moves to Lost & Found and is not spending or income.',
  },
];

export const SETTLE_GROUPS = [['in', 'They → you'], ['out', 'You → them'], ['off', 'Forgive']];

// The amount that brings the balance to zero with this mode (ZERO if none).
export function settlingAmount(mode, balance) {
  if (mode === 'write_off') return balance.abs();
  const group = SETTLE_MODES.find((m) => m.value === mode)?.group;
  if (group === 'out') return balance.lt(0) ? balance.abs() : ZERO;
  return balance.gt(0) ? balance : ZERO;
}
