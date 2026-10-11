import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { useHideAmounts } from '../hooks/useHideAmounts';
import Card from '../components/common/Card';
import Modal from '../components/common/Modal';
import Select from '../components/common/Select';
import CalendarPicker from '../components/common/CalendarPicker';
import HideAmountsToggle from '../components/common/HideAmountsToggle';
import AccountPicker from '../components/forms/AccountPicker';
import { formatDate, formatINR, MASKED_AMOUNT } from '../utils/formatters';
import { labelClass, errorClass, categoryOptions } from '../utils/formStyles';
import { D, round2, sum } from '../utils/money';
import {
  balanceSentence, groupByPerson, settlingAmount, SETTLE_GROUPS, SETTLE_MODES,
} from '../utils/people';

// Each mode records one movement in the person's balance, server-side.
const MODES = Object.fromEntries(SETTLE_MODES.map((m) => [m.value, m]));

const MOVEMENT_TEXT = {
  split: (m) => m.label || 'Split expense',
  money_in: (m) => `Received into ${m.label}`,
  money_out: (m) => `Sent from ${m.label}`,
  paid_for_me: (m) => `Paid for your ${m.label}`,
  paid_for_them: (m) => `Paid for their ${m.label}`,
  write_off: () => 'Written off',
};

function todayLocal() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function balanceText(balance) {
  if (balance.gt(0)) return 'owes you';
  if (balance.lt(0)) return 'you owe';
  return 'settled';
}

export default function PeoplePage() {
  const { receivables } = useData();
  const [hidden, toggleHidden] = useHideAmounts();
  const [view, setView] = useState('open');
  const [settling, setSettling] = useState(null); // { person, mode }

  const people = useMemo(() => groupByPerson(receivables ?? []), [receivables]);
  const openPeople = people.filter((p) => !p.balance.isZero()).sort((a, b) => b.balance.abs().comparedTo(a.balance.abs()));
  const settledPeople = people.filter((p) => p.balance.isZero()).sort((a, b) => a.name.localeCompare(b.name));
  const shown = view === 'open' ? openPeople : settledPeople;
  const owedToYou = sum(openPeople.filter((p) => p.balance.gt(0)).map((p) => p.balance));
  const youOwe = sum(openPeople.filter((p) => p.balance.lt(0)).map((p) => p.balance.abs()));
  const money = (v) => (hidden ? MASKED_AMOUNT : formatINR(v));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold text-gray-900">People</h1>
          <p className="text-sm text-gray-400 mt-1">One running balance with each person: what they owe you, and what you owe them.</p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <Link
            to="/transactions/new?type=reimbursement"
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            + Money with a person
          </Link>
          <Link
            to="/transactions/new?type=split_expense"
            className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover transition-colors"
          >
            + New split expense
          </Link>
        </div>
      </div>

      <Card className="relative p-5">
        <div className="absolute right-5 top-4">
          <HideAmountsToggle hidden={hidden} onToggle={toggleHidden} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Owed to you</p>
            <p className={`text-2xl font-bold tabular-nums mt-1 ${hidden ? 'text-gray-400' : 'text-gray-900'}`}>{money(owedToYou)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">You owe</p>
            <p className={`text-2xl font-bold tabular-nums mt-1 ${hidden ? 'text-gray-400' : 'text-gray-900'}`}>{money(youOwe)}</p>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {openPeople.length === 0
            ? 'All settled with everyone.'
            : `${openPeople.length} open ${openPeople.length === 1 ? 'balance' : 'balances'}`}
        </p>
      </Card>

      <div className="inline-flex rounded-lg border border-gray-200 p-0.5 text-xs">
        {[['open', `Open (${openPeople.length})`], ['settled', `Settled (${settledPeople.length})`]].map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              view === v ? 'bg-brand text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Card className="p-8 text-center text-sm text-gray-500">
          {view === 'open'
            ? 'Nothing open. Record a split expense when you pay for someone, or record money when someone gives you some.'
            : 'No settled balances yet.'}
        </Card>
      ) : (
        <div className="space-y-4">
          {shown.map((person) => (
            <PersonCard
              key={person.key}
              person={person}
              money={money}
              onSettle={(mode) => setSettling({ person, mode })}
            />
          ))}
        </div>
      )}

      {settling && (
        <SettleModal
          person={settling.person}
          mode={settling.mode}
          onClose={() => setSettling(null)}
        />
      )}
    </div>
  );
}

function PersonCard({ person, money, onSettle }) {
  const isOpen = !person.balance.isZero();
  const [expanded, setExpanded] = useState(isOpen);

  return (
    <Card className="p-0 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-gray-50/80 transition-colors"
      >
        <div className="min-w-0">
          <p className="text-base font-bold text-gray-900">{person.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {person.items.length} movement{person.items.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-bold tabular-nums text-gray-900">{isOpen ? money(person.balance.abs()) : 'Settled'}</p>
          {isOpen && <p className="text-[11px] text-gray-400">{balanceText(person.balance)}</p>}
        </div>
      </button>

      {/* Grouped by direction; the action that settles the balance stands out. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 pb-4">
        {SETTLE_GROUPS.filter(([group]) => group !== 'off' || isOpen).map(([group, heading]) => (
          <div key={group} className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{heading}</span>
            {SETTLE_MODES.filter((m) => m.group === group).map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => onSettle(m.value)}
                className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
                  (person.balance.lt(0) ? m.value === 'money_out' : m.value === 'money')
                    ? 'bg-brand text-white hover:bg-brand-hover'
                    : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        ))}
      </div>

      {expanded && (
        <ul className="border-t border-gray-100 divide-y divide-gray-50">
          {[...person.items].reverse().map((item) => (
            <li key={item.id} className="px-5 py-3">
              <div className="flex items-start justify-between gap-3 text-sm">
                <Link to={`/transactions/${item.transaction}/edit`} className="min-w-0 hover:underline">
                  <span className="text-gray-700 break-words">{(MOVEMENT_TEXT[item.kind] ?? MOVEMENT_TEXT.split)(item)}</span>
                  <span className="block text-[11px] text-gray-400">{item.transaction_date && formatDate(item.transaction_date)}</span>
                </Link>
                <div className="text-right flex-shrink-0">
                  <p className="font-semibold tabular-nums text-gray-800">
                    {item.amount.gt(0) ? '+' : '−'}{money(item.amount.abs())}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {item.balanceAfter.isZero() ? 'settled' : `${money(item.balanceAfter.abs())} ${balanceText(item.balanceAfter)}`}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function SettleModal({ person, mode, onClose }) {
  const { accounts, categories, loadData } = useData();
  const toast = useToast();
  const action = MODES[mode];
  const fullAmount = settlingAmount(mode, person.balance);
  // A payment for something is its own amount; money and write-offs default
  // to what settles the balance.
  const prefill = mode !== 'paid_for_me' && mode !== 'paid_for_them' && fullAmount.gt(0);

  const [amount, setAmount] = useState(prefill ? fullAmount.toString() : '');
  const [date, setDate] = useState(todayLocal());
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const assetAccounts = accounts.filter((a) => a.type === 'asset' && a.is_active !== false);
  // Paying for someone can go on a card too.
  const payingAccounts = accounts.filter(
    (a) => (a.type === 'asset' || a.type === 'liability') && a.is_active !== false,
  );
  const spendCategories = categories.filter((c) => c.type === 'expense' && !c.role);

  function validate() {
    const errs = {};
    const parsed = D(amount || 0);
    if (!parsed.gt(0)) errs.amount = 'Enter a positive amount.';
    else if (mode === 'write_off' && parsed.minus(fullAmount).gt('0.001')) {
      errs.amount = `The balance is ${formatINR(fullAmount)}.`;
    }
    if (!date) errs.date = 'Pick a date.';
    if (['money', 'money_out', 'paid_for_them'].includes(mode) && !accountId) errs.account = 'Select the account.';
    if (mode === 'paid_for_me' && !categoryId) errs.category = 'Select what they paid for.';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setBusy(true);
    try {
      const result = await api.settleReceivables({
        person_name: person.name,
        mode,
        amount: round2(D(amount)).toString(),
        date,
        ...(mode === 'money' ? { to_account_id: parseInt(accountId, 10) } : {}),
        ...(mode === 'money_out' || mode === 'paid_for_them' ? { from_account_id: parseInt(accountId, 10) } : {}),
        ...((mode === 'paid_for_me' || mode === 'paid_for_them') && categoryId ? { category_id: parseInt(categoryId, 10) } : {}),
      });
      const balance = D(result.balance);
      toast.success(balance.isZero() ? `Settled with ${person.name}` : balanceSentence(person.name, balance));
      await loadData();
      onClose();
    } catch (err) {
      setErrors({ submit: err.message || 'Could not save.' });
      setBusy(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={`${action.title} · ${person.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-500">{action.help}</p>

        <div>
          <label className={labelClass}>Amount</label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-gray-300">₹</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50/50 pl-8 pr-3 py-2.5 text-sm font-semibold text-gray-900 focus:border-accent focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>
          <p className="mt-1 text-[11px] text-gray-400">
            {balanceSentence(person.name, person.balance)}
          </p>
          {errors.amount && <p className={errorClass}>{errors.amount}</p>}
        </div>

        <div>
          <label className={labelClass}>Date</label>
          <CalendarPicker value={date} onChange={setDate} className="w-full" />
          {errors.date && <p className={errorClass}>{errors.date}</p>}
        </div>

        {['money', 'money_out', 'paid_for_them'].includes(mode) && (
          <AccountPicker
            value={accountId}
            accounts={mode === 'paid_for_them' ? payingAccounts : assetAccounts}
            label={{ money: 'Received Into', money_out: 'Sent From', paid_for_them: 'Paid From' }[mode]}
            error={errors.account}
            onChange={(id) => setAccountId(id)}
          />
        )}

        {(mode === 'paid_for_me' || mode === 'paid_for_them') && (
          <div>
            <label className={labelClass}>{mode === 'paid_for_me' ? 'What They Paid For' : 'What For (Optional)'}</label>
            <Select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              options={categoryOptions(spendCategories)}
              placeholder={mode === 'paid_for_me' ? 'Select category' : 'Not recorded'}
            />
            {errors.category && <p className={errorClass}>{errors.category}</p>}
          </div>
        )}

        {errors.submit && <p className="text-sm text-rose-500">{errors.submit}</p>}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50 transition-colors"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
