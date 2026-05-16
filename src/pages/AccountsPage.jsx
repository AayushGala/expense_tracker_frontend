import { useState, useMemo } from 'react';
import { useAccounts } from '../hooks/useAccounts';
import { useOwners } from '../hooks/useOwners';
import { useData } from '../context/DataContext';
import { formatINR } from '../utils/formatters';
import { sum, ZERO } from '../utils/money';
import Card from '../components/common/Card';
import AmountDisplay from '../components/common/AmountDisplay';
import EmptyState from '../components/common/EmptyState';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';
import Dropdown from '../components/common/Dropdown';
import TransactionDetail from '../components/transactions/TransactionDetail';
import { formatDate } from '../utils/formatters';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCOUNT_SECTIONS = [
  { key: 'asset',      label: 'Assets',      badgeType: 'income' },
  { key: 'liability',  label: 'Liabilities',  badgeType: 'expense' },
  { key: 'receivable', label: 'Receivables',  badgeType: 'transfer' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function subTypeLabel(sub) {
  if (!sub) return '';
  return sub.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// AccountTypeBadge — inline colour chip for account type
// ---------------------------------------------------------------------------

function AccountTypeBadge({ type, subType }) {
  const colors = {
    asset:      'bg-accent-light text-brand ring-accent/30',
    liability:  'bg-brand text-white ring-brand/20',
    receivable: 'bg-gray-100 text-gray-600 ring-gray-200/60',
  };
  return (
    <span
      className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-semibold ring-1 ${
        colors[type] ?? 'bg-gray-50 text-gray-600 ring-gray-200/60'
      }`}
    >
      {subType ? subTypeLabel(subType) : type}
    </span>
  );
}

// ---------------------------------------------------------------------------
// AccountLedger — displayed inside a modal
// ---------------------------------------------------------------------------

function AccountLedger({ account, ledger, transactions, onEntryClick }) {
  // Build a lookup for transaction descriptions
  const txnMap = useMemo(
    () => new Map((transactions ?? []).map((t) => [t.id, t])),
    [transactions]
  );

  if (ledger.length === 0) {
    return (
      <EmptyState
        message="No entries yet"
        description="Transactions involving this account will appear here."
        className="py-8"
      />
    );
  }

  function txnLabel(entry) {
    const txn = txnMap.get(entry.transaction_id);
    if (!txn) return '';
    return txn.notes || txn.beneficiary || txn.description || '';
  }

  // For debit-normal accounts (asset, receivable): debit = money in (+)
  // For credit-normal accounts (liability): credit = money in (+)
  const isDebitNormal = account.type === 'asset' || account.type === 'receivable';

  return (
    <div className="space-y-2">
      {ledger.map((entry) => {
        const label = txnLabel(entry);
        const isDebit = entry.entry_type === 'DEBIT';
        const isPositive = isDebitNormal ? isDebit : !isDebit;
        const txn = txnMap.get(entry.transaction_id);

        return (
          <button
            key={entry.id}
            type="button"
            onClick={() => txn && onEntryClick?.(txn)}
            disabled={!txn}
            className="w-full flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3 text-left hover:bg-gray-100 transition-colors disabled:cursor-default disabled:hover:bg-gray-50"
          >
            {/* Details */}
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-gray-800 truncate">
                {label || formatDate(entry.date)}
              </p>
              {label && (
                <p className="text-[11px] text-gray-400 mt-0.5">{formatDate(entry.date)}</p>
              )}
            </div>

            {/* Badge */}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
              isPositive ? 'bg-accent-light text-brand' : 'bg-gray-200 text-gray-600'
            }`}>
              {isDebit ? 'DR' : 'CR'}
            </span>

            {/* Amount */}
            <p className={`text-[15px] font-semibold tabular-nums shrink-0 ${
              isPositive ? 'text-accent' : 'text-gray-800'
            }`}>
              {isPositive ? '+' : '-'}{formatINR(entry.amount)}
            </p>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AccountCard — single account tile
// ---------------------------------------------------------------------------

const ACCOUNT_ICONS = {
  bank:        'M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3',
  cash:        'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
  wallet:      'M21 12a2 2 0 00-2-2h-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-2a2 2 0 00-2-2M17 12a1 1 0 110 2 1 1 0 010-2z',
  brokerage:   'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  savings:     'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  credit_card: 'M3 10h18M7 15h.01M11 15h2M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z',
  loan:        'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z',
  receivable:  'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  other:       'M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3z',
};

const ACCOUNT_ICON_COLORS = {
  asset:      'bg-accent-light text-brand',
  liability:  'bg-brand/10 text-brand',
  receivable: 'bg-gray-100 text-gray-500',
};

function AccountIcon({ type, subType }) {
  const path = ACCOUNT_ICONS[subType] ?? ACCOUNT_ICONS[type] ?? ACCOUNT_ICONS.other;
  const color = ACCOUNT_ICON_COLORS[type] ?? 'bg-gray-100 text-gray-500';
  return (
    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color} flex-shrink-0`}>
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </svg>
    </div>
  );
}

function AccountCard({ account, balance, onClick }) {
  return (
    <Card
      onClick={() => onClick(account)}
      className="p-4 flex items-center gap-3.5"
    >
      <AccountIcon type={account.type} subType={account.sub_type} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 truncate">{account.name}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <AccountTypeBadge type={account.type} subType={account.sub_type} />
          {account.owner && (
            <span className="inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-semibold ring-1 bg-gray-100 text-gray-600 ring-gray-200/60">
              {account.owner}
            </span>
          )}
          {account.currency && account.currency !== 'INR' && (
            <span className="text-[11px] text-gray-400 font-medium">{account.currency}</span>
          )}
        </div>
      </div>
      <AmountDisplay
        amount={balance}
        variant={
          account.type === 'asset' || account.type === 'receivable' ? 'income' : 'expense'
        }
        className="text-base font-bold flex-shrink-0"
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// AccountSection — titled group of accounts
// ---------------------------------------------------------------------------

function AccountSection({ title, accounts, getBalance, onAccountClick, balanceSummary }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          <span className="text-xs font-medium text-gray-400">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</span>
        </div>
        {balanceSummary !== undefined && (
          <AmountDisplay amount={balanceSummary} className="text-sm font-bold" />
        )}
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 py-10 flex items-center justify-center">
          <p className="text-sm text-gray-400">No {title.toLowerCase()} accounts yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              balance={getBalance(account.id)}
              onClick={onAccountClick}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// AccountsPage
// ---------------------------------------------------------------------------

export default function AccountsPage() {
  const { isLoading, transactions, entries } = useData();
  const { accountsByType, getAccountBalance, getAccountLedger } = useAccounts();
  const { owners, ownerOptions } = useOwners();

  const [ledgerAccount, setLedgerAccount] = useState(null); // account object | null
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [ownerFilter, setOwnerFilter] = useState('');

  // Filter accounts by owner when a filter is active
  const filteredByType = useMemo(() => {
    if (!ownerFilter) return accountsByType;
    const result = {};
    for (const key of Object.keys(accountsByType)) {
      result[key] = (accountsByType[key] ?? []).filter(
        (a) => a.owner === ownerFilter
      );
    }
    return result;
  }, [accountsByType, ownerFilter]);

  // Pre-compute section totals. Balances are Decimals — the `+` operator
  // would silently produce string concatenation (Decimal.valueOf returns a
  // string), so use the Decimal-aware sum helper.
  const assetTotal = useMemo(
    () => sum((filteredByType.asset ?? []).map((a) => getAccountBalance(a.id) ?? ZERO)),
    [filteredByType, getAccountBalance]
  );
  const liabilityTotal = useMemo(
    () => sum((filteredByType.liability ?? []).map((a) => getAccountBalance(a.id) ?? ZERO)),
    [filteredByType, getAccountBalance]
  );
  const receivableTotal = useMemo(
    () => sum((filteredByType.receivable ?? []).map((a) => getAccountBalance(a.id) ?? ZERO)),
    [filteredByType, getAccountBalance]
  );

  const sectionTotals = {
    asset: assetTotal,
    liability: liabilityTotal,
    receivable: receivableTotal,
  };

  // Ledger for selected account
  const ledgerEntries = useMemo(
    () => (ledgerAccount ? getAccountLedger(ledgerAccount.id) : []),
    [ledgerAccount, getAccountLedger]
  );

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  function handleAccountClick(account) {
    setLedgerAccount(account);
  }

  // -------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <LoadingSpinner size="h-10 w-10" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
          <p className="text-sm text-gray-400 mt-1">Manage your financial accounts and track balances.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {owners.length > 0 && (
            <Dropdown
              value={ownerFilter}
              onChange={setOwnerFilter}
              options={ownerOptions}
              className="min-w-[130px]"
            />
          )}
        </div>
      </div>

      {/* Net worth summary bar */}
      <Card className="p-0 overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100">
          <div className="p-5">
            <p className="text-[11px] text-gray-400 mb-1.5 uppercase tracking-wider font-semibold">
              Total Assets
            </p>
            <AmountDisplay amount={assetTotal} variant="income" className="text-xl font-bold" />
          </div>
          <div className="p-5">
            <p className="text-[11px] text-gray-400 mb-1.5 uppercase tracking-wider font-semibold">
              Total Liabilities
            </p>
            <AmountDisplay amount={liabilityTotal} variant="expense" className="text-xl font-bold" />
          </div>
          <div className="p-5">
            <p className="text-[11px] text-gray-400 mb-1.5 uppercase tracking-wider font-semibold">
              Receivables
            </p>
            <AmountDisplay amount={receivableTotal} className="text-xl font-bold" />
          </div>
          <div className="p-5 bg-gray-50/50">
            <p className="text-[11px] text-gray-400 mb-1.5 uppercase tracking-wider font-semibold">
              Net Worth
            </p>
            <AmountDisplay
              amount={assetTotal + receivableTotal - liabilityTotal}
              className="text-xl font-bold"
            />
          </div>
        </div>
      </Card>

      {/* Sections */}
      {ACCOUNT_SECTIONS.map(({ key, label }) => (
        <AccountSection
          key={key}
          title={label}
          accounts={filteredByType[key] ?? []}
          getBalance={getAccountBalance}
          onAccountClick={handleAccountClick}
          balanceSummary={sectionTotals[key]}
        />
      ))}

      {/* Account Ledger modal */}
      <Modal
        isOpen={ledgerAccount !== null}
        onClose={() => setLedgerAccount(null)}
        title={ledgerAccount ? `${ledgerAccount.name} — Ledger` : 'Ledger'}
        maxWidth="max-w-lg md:max-w-2xl"
      >
        {ledgerAccount && (
          <div className="flex flex-col gap-5">
            {/* Balance summary */}
            <div className="flex items-center justify-between rounded-2xl bg-brand px-5 py-4">
              <div>
                <p className="text-[11px] text-brand-muted font-medium uppercase tracking-wider">Current Balance</p>
                <p className="text-2xl font-bold text-white tabular-nums mt-1">
                  {formatINR(getAccountBalance(ledgerAccount.id).abs())}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-brand-muted font-medium capitalize">{ledgerAccount.sub_type || ledgerAccount.type}</p>
                <p className="text-[11px] text-[#556d72]">{ledgerAccount.currency ?? 'INR'}</p>
              </div>
            </div>

            {/* Entries */}
            <AccountLedger
              account={ledgerAccount}
              ledger={ledgerEntries}
              transactions={transactions}
              onEntryClick={setSelectedTxn}
            />
          </div>
        )}
      </Modal>

      {/* Transaction Detail modal (opens on top of the ledger when an entry is clicked) */}
      <Modal
        isOpen={selectedTxn !== null}
        onClose={() => setSelectedTxn(null)}
        title="Transaction Details"
        maxWidth="max-w-lg"
      >
        {selectedTxn && (
          <TransactionDetail
            transaction={selectedTxn}
            entries={entries.filter((e) => e.transaction_id === selectedTxn.id)}
            onClose={() => setSelectedTxn(null)}
            onDeleted={() => setSelectedTxn(null)}
            onSelectTransaction={setSelectedTxn}
          />
        )}
      </Modal>
    </div>
  );
}
