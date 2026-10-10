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
import { D, ZERO, round2, sum } from '../utils/money';

// How a receivable gets settled. Each choice becomes one reimbursement per
// receivable it touches (oldest first), server-side.
const SETTLE_ACTIONS = {
  money: {
    button: 'Record payment',
    title: 'Record a payment',
    help: 'They paid you back into one of your accounts.',
  },
  paid_for_me: {
    button: 'Paid for me',
    title: 'They paid for something of yours',
    help: 'It counts as your spending and reduces what they owe.',
  },
  write_off: {
    button: 'Write off',
    title: 'Write off',
    help: 'You will not get this back. It moves to Lost & Found and does not count as spending.',
  },
};

const SETTLEMENT_TEXT = {
  money: (s) => `Paid back into ${s.label}`,
  paid_for_me: (s) => `Paid for your ${s.label}`,
  write_off: () => 'Written off',
};

function todayLocal() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// One entry per person (names match case-insensitively), newest split first.
function groupByPerson(receivables) {
  const people = new Map();
  for (const r of receivables) {
    const key = r.person_name.trim().toLowerCase();
    if (!people.has(key)) people.set(key, { key, name: r.person_name.trim(), items: [] });
    people.get(key).items.push({ ...r, outstanding: r.amount_owed.minus(r.amount_settled) });
  }
  return [...people.values()].map((p) => {
    p.items.sort((a, b) => (b.transaction_date ?? '').localeCompare(a.transaction_date ?? '') || b.id - a.id);
    p.owed = sum(p.items.map((i) => i.amount_owed));
    p.outstanding = sum(p.items.map((i) => i.outstanding));
    return p;
  });
}

export default function ReceivablesPage() {
  const { receivables } = useData();
  const [hidden, toggleHidden] = useHideAmounts();
  const [view, setView] = useState('open');
  const [settling, setSettling] = useState(null); // { person, mode }

  const people = useMemo(() => groupByPerson(receivables ?? []), [receivables]);
  const openPeople = people.filter((p) => p.outstanding.gt(0)).sort((a, b) => b.outstanding.comparedTo(a.outstanding));
  const settledPeople = people.filter((p) => !p.outstanding.gt(0)).sort((a, b) => a.name.localeCompare(b.name));
  const shown = view === 'open' ? openPeople : settledPeople;
  const totalOwed = sum(openPeople.map((p) => p.outstanding));
  const money = (v) => (hidden ? MASKED_AMOUNT : formatINR(v));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold text-gray-900">Receivables</h1>
          <p className="text-sm text-gray-400 mt-1">Money people owe you from split expenses.</p>
        </div>
        <Link
          to="/transactions/new?type=split_expense"
          className="self-start sm:self-auto rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover transition-colors"
        >
          + New split expense
        </Link>
      </div>

      <Card className="relative p-5">
        <div className="absolute right-5 top-4">
          <HideAmountsToggle hidden={hidden} onToggle={toggleHidden} />
        </div>
        <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Owed to you</p>
        <p className={`text-2xl font-bold tabular-nums mt-1 ${hidden ? 'text-gray-400' : 'text-gray-900'}`}>{money(totalOwed)}</p>
        <p className="text-xs text-gray-400 mt-1">
          {openPeople.length === 0
            ? 'Nobody owes you anything.'
            : `${openPeople.length} ${openPeople.length === 1 ? 'person' : 'people'}`}
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
            ? 'Nothing open. Record a split expense when you pay for someone who will pay you back.'
            : 'No fully settled people yet.'}
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
  const [expanded, setExpanded] = useState(person.outstanding.gt(0));
  const isOpen = person.outstanding.gt(0);

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
            {person.items.length} split{person.items.length === 1 ? '' : 's'} · {money(person.owed)} in total
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-bold tabular-nums text-gray-900">{isOpen ? money(person.outstanding) : 'Settled'}</p>
          {isOpen && <p className="text-[11px] text-gray-400">still owed</p>}
        </div>
      </button>

      {isOpen && (
        <div className="flex flex-wrap gap-2 px-5 pb-4">
          {Object.entries(SETTLE_ACTIONS).map(([mode, a]) => (
            <button
              key={mode}
              type="button"
              onClick={() => onSettle(mode)}
              className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
                mode === 'money'
                  ? 'bg-brand text-white hover:bg-brand-hover'
                  : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {a.button}
            </button>
          ))}
        </div>
      )}

      {expanded && (
        <ul className="border-t border-gray-100 divide-y divide-gray-50">
          {person.items.map((item) => (
            <li key={item.id} className="px-5 py-3">
              <div className="flex items-start justify-between gap-3 text-sm">
                <Link to={`/transactions/${item.transaction}/edit`} className="min-w-0 hover:underline">
                  <span className="text-gray-700 break-words">{item.transaction_label || 'Split expense'}</span>
                  <span className="block text-[11px] text-gray-400">{item.transaction_date && formatDate(item.transaction_date)}</span>
                </Link>
                <div className="text-right flex-shrink-0">
                  <p className="font-semibold tabular-nums text-gray-800">
                    {item.outstanding.gt(0) ? money(item.outstanding) : money(item.amount_owed)}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {item.status === 'settled' ? 'settled' : item.status === 'partial' ? `of ${money(item.amount_owed)}` : 'owed'}
                  </p>
                </div>
              </div>
              {item.settlements?.length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {[...item.settlements].reverse().map((s) => (
                    <li key={s.transaction_id} className="text-[11px] text-gray-400">
                      <Link to={`/transactions/${s.transaction_id}/edit`} className="hover:underline">
                        {formatDate(s.date)} · {SETTLEMENT_TEXT[s.kind](s)} · {money(D(s.amount))}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
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
  const action = SETTLE_ACTIONS[mode];

  const [amount, setAmount] = useState(person.outstanding.toString());
  const [date, setDate] = useState(todayLocal());
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const assetAccounts = accounts.filter((a) => a.type === 'asset' && a.is_active !== false);
  const spendCategories = categories.filter((c) => c.type === 'expense' && !c.role);

  function validate() {
    const errs = {};
    const parsed = D(amount || 0);
    if (!parsed.gt(0)) errs.amount = 'Enter a positive amount.';
    else if (parsed.minus(person.outstanding).gt('0.001')) errs.amount = `${person.name} owes ${formatINR(person.outstanding)}.`;
    if (!date) errs.date = 'Pick a date.';
    if (mode === 'money' && !accountId) errs.account = 'Select the account the money came into.';
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
      await api.settleReceivables({
        person_name: person.name,
        mode,
        amount: round2(D(amount)).toString(),
        date,
        ...(mode === 'money' ? { to_account_id: parseInt(accountId, 10) } : {}),
        ...(mode === 'paid_for_me' ? { category_id: parseInt(categoryId, 10) } : {}),
      });
      toast.success(mode === 'write_off' ? `Wrote off ${formatINR(D(amount))}` : `Settled ${formatINR(D(amount))}`);
      await loadData();
      onClose();
    } catch (err) {
      setErrors({ submit: err.message || 'Could not settle.' });
      setBusy(false);
    }
  }

  const partial = D(amount || 0).lt(person.outstanding) && D(amount || 0).gt(ZERO);

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
            {partial
              ? 'Less than the full amount: the oldest splits are settled first.'
              : `Full amount owed: ${formatINR(person.outstanding)}.`}
          </p>
          {errors.amount && <p className={errorClass}>{errors.amount}</p>}
        </div>

        <div>
          <label className={labelClass}>Date</label>
          <CalendarPicker value={date} onChange={setDate} className="w-full" />
          {errors.date && <p className={errorClass}>{errors.date}</p>}
        </div>

        {mode === 'money' && (
          <AccountPicker
            value={accountId}
            accounts={assetAccounts}
            label="Received Into"
            error={errors.account}
            onChange={(id) => setAccountId(id)}
          />
        )}

        {mode === 'paid_for_me' && (
          <div>
            <label className={labelClass}>What They Paid For</label>
            <Select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              options={categoryOptions(spendCategories)}
              placeholder="Select category"
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
            {busy ? 'Saving…' : action.button}
          </button>
        </div>
      </form>
    </Modal>
  );
}
