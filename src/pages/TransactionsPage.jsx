import { useState, useCallback, useMemo } from 'react';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { useNavigate } from 'react-router-dom';
import { useTransactions } from '../hooks/useTransactions';
import { useTransactionSummary } from '../hooks/useTransactionSummary';
import { useData } from '../context/DataContext';
import FilterBar from '../components/common/FilterBar';
import Badge from '../components/common/Badge';
import AmountDisplay from '../components/common/AmountDisplay';
import EmptyState from '../components/common/EmptyState';
import Modal from '../components/common/Modal';
import Card from '../components/common/Card';
import TransactionDetail from '../components/transactions/TransactionDetail';
import TransactionSummary from '../components/transactions/TransactionSummary';
import SavedViews from '../components/transactions/SavedViews';
import { formatDate, transactionTypeLabel } from '../utils/formatters';
import { getThisMonthRange } from '../utils/datePresets';
import { downloadTransactionsCSV } from '../utils/transactionCsv';
import TypeIcon, { getVariant } from '../components/common/TypeIcon';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDateKey(isoDate) {
  return isoDate?.slice(0, 10) ?? '';
}

function groupByDate(transactions) {
  const groups = new Map();
  for (const txn of transactions) {
    const key = toDateKey(txn.date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(txn);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Sort header button (desktop table)
// ---------------------------------------------------------------------------

function SortIcon({ direction }) {
  if (direction === 'asc') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
      </svg>
    );
  }
  if (direction === 'desc') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
    );
  }
  // Inactive: subtle up/down chevrons
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-300" viewBox="0 0 20 20" fill="currentColor">
      <path d="M5 8l5-5 5 5H5zm0 4l5 5 5-5H5z" />
    </svg>
  );
}

function SortableHeader({ label, sortKey, sortChain, onSort, align = 'left', className = '' }) {
  const idx = sortChain.findIndex((c) => c.key === sortKey);
  const active = idx >= 0;
  const direction = active ? sortChain[idx].dir : null;
  const showRank = active && sortChain.length > 1;
  const justify = align === 'right' ? 'justify-end' : 'justify-start';
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`w-full flex items-center gap-1 ${justify} text-[11px] font-semibold uppercase tracking-wider transition-colors ${active ? 'text-gray-700' : 'text-gray-400 hover:text-gray-600'} ${className}`}
    >
      <span>{label}</span>
      <SortIcon direction={direction} />
      {showRank && (
        <span className="ml-0.5 inline-flex items-center justify-center h-3.5 min-w-[14px] px-1 rounded-sm bg-accent-light text-[9px] font-bold text-brand">
          {idx + 1}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// TransactionRow — table-style row (desktop)
// ---------------------------------------------------------------------------

function TransactionRow({ txn, onClick }) {
  return (
    <tr
      tabIndex={0}
      onClick={() => onClick(txn)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(txn); } }}
      className="hover:bg-gray-50/80 cursor-pointer transition-colors group"
    >
      {/* Date */}
      <td className="py-4 pl-5 pr-3 whitespace-nowrap">
        <p className="text-sm font-medium text-gray-700">{formatDate(txn.date)}</p>
      </td>

      {/* Description with icon */}
      <td className="py-4 px-3">
        <div className="flex items-start gap-3">
          <TypeIcon type={txn.type} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 break-words">
              {txn.notes || transactionTypeLabel(txn.type)}
            </p>
            {(txn.accountNames?.length > 0 || txn.platform) && (
              <p className="text-xs text-gray-400 break-words mt-0.5">
                {[txn.accountNames?.join(' · '), txn.platform].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>
      </td>

      {/* Category */}
      <td className="py-4 px-3 hidden lg:table-cell">
        {txn.categoryNames?.length > 0 && (
          <span className="inline-flex items-center rounded-lg bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 uppercase tracking-wide">
            {txn.categoryNames[0]}
          </span>
        )}
      </td>

      {/* Amount */}
      <td className="py-4 px-3 text-right whitespace-nowrap">
        <AmountDisplay
          amount={txn.amount ?? 0}
          variant={getVariant(txn.type)}
          className="text-sm"
        />
      </td>

      {/* Status badge */}
      <td className="py-4 pl-3 pr-5 hidden sm:table-cell">
        <Badge type={txn.type} />
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// TransactionCard — mobile card view
// ---------------------------------------------------------------------------

function TransactionCard({ txn, onClick }) {
  return (
    <button
      onClick={() => onClick(txn)}
      className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-gray-50/80 transition-colors"
    >
      <TypeIcon type={txn.type} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 break-words">
          {txn.notes || transactionTypeLabel(txn.type)}
        </p>
        <p className="text-xs text-gray-400 mt-0.5 break-words">
          {formatDate(txn.date)}
          {txn.categoryNames?.length > 0 && ` · ${txn.categoryNames[0]}`}
          {txn.platform && ` · ${txn.platform}`}
        </p>
      </div>
      <AmountDisplay
        amount={txn.amount ?? 0}
        variant={getVariant(txn.type)}
        className="text-sm font-bold flex-shrink-0"
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50; // matches backend DRF PAGE_SIZE

function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, start + 4);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex items-center justify-between pt-4 px-1">
      <p className="text-xs text-gray-400">
        Page {currentPage} of {totalPages}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </button>
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
              p === currentPage
                ? 'bg-brand text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TransactionsPage
// ---------------------------------------------------------------------------

const EMPTY_FILTERS = {
  dateFrom: '',
  dateTo: '',
  types: [],
  accountIds: [],
  categoryIds: [],
  categoryType: '',
  owners: [],
  beneficiaries: [],
  platforms: [],
  tags: [],
  search: '',
};

/** Page defaults to the current month so the summary is immediately relevant. */
function getDefaultFilters() {
  const { dateFrom, dateTo } = getThisMonthRange();
  return { ...EMPTY_FILTERS, dateFrom, dateTo };
}

// Schema for useUrlFilters. `keepEmpty: true` on the dates so a deliberate
// "clear" survives reloads instead of snapping back to this-month default.
const FILTER_SCHEMA = {
  dateFrom:      { keepEmpty: true },
  dateTo:        { keepEmpty: true },
  types:         { array: true },
  accountIds:    { array: true },
  categoryIds:   { array: true },
  categoryType:  {},
  owners:        { array: true },
  beneficiaries: { array: true },
  platforms:     { array: true },
  tags:          { array: true },
  search:        {},
};

export default function TransactionsPage() {
  const navigate = useNavigate();
  const { isLoading, deleteTransaction } = useData();

  // URL-backed so reload/share/bookmark preserves the filter view.
  const [filters, setFilters] = useUrlFilters(FILTER_SCHEMA, getDefaultFilters());
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [splitMode, setSplitMode] = useState('my_share');
  // Multi-column sort: first click adds the column as a tiebreaker at the end
  // of the chain, so already-sorted columns keep their priority. Default: empty
  // chain — the data comes pre-sorted by date desc from useTransactions.
  const [sortChain, setSortChain] = useState([]);

  const { filteredTransactions, getTransactionEntries } = useTransactions(filters);
  const { summary, isLoading: summaryLoading } = useTransactionSummary(filters, splitMode);

  const sortedTransactions = useMemo(() => {
    const arr = [...filteredTransactions];
    arr.sort((a, b) => {
      for (const { key, dir } of sortChain) {
        let cmp;
        if (key === 'amount') {
          cmp = (a.amount ?? 0) - (b.amount ?? 0);
        } else {
          cmp = new Date(a.date) - new Date(b.date);
        }
        if (cmp !== 0) return dir === 'asc' ? cmp : -cmp;
      }
      return 0;
    });
    return arr;
  }, [filteredTransactions, sortChain]);

  /**
   * Click cycle for each column: asc → desc → remove.
   * - Not in chain → append as asc (lowest-priority tiebreaker).
   * - In chain as asc → flip to desc (priority unchanged).
   * - In chain as desc → remove from chain.
   * This keeps earlier sorts intact; a new column joins as a tiebreaker.
   */
  function handleSort(key) {
    setSortChain((chain) => {
      const idx = chain.findIndex((c) => c.key === key);
      if (idx === -1) return [...chain, { key, dir: 'asc' }];
      if (chain[idx].dir === 'asc') {
        return chain.map((c, i) => (i === idx ? { ...c, dir: 'desc' } : c));
      }
      return chain.filter((_, i) => i !== idx);
    });
    setCurrentPage(1);
  }

  const totalPages = Math.ceil(sortedTransactions.length / PAGE_SIZE);
  const paginatedTxns = sortedTransactions.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleFilterChange = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  }, []);

  const handleBulkFilterChange = useCallback((partial) => {
    setFilters((prev) => ({ ...prev, ...partial }));
    setCurrentPage(1);
  }, []);

  const handleReset = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setCurrentPage(1);
  }, []);

  function handleRowClick(txn) {
    setSelectedTxn(txn);
  }

  function handleModalClose() {
    setSelectedTxn(null);
  }

  if (isLoading) return null; // DataGate handles the loading screen

  return (
    <div className="space-y-6">
      {/* Page header — hidden on mobile (TopBar shows title) */}
      <div className="hidden md:block">
        <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
        <p className="text-sm text-gray-400 mt-1">Review and manage your financial movement across all accounts.</p>
      </div>

      {/* Filter bar */}
      <Card className="px-5 py-4 overflow-visible space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Saved Views</p>
          <SavedViews
            filters={filters}
            onApply={handleBulkFilterChange}
            className="w-56"
          />
        </div>
        <div className="border-t border-gray-100 -mx-5" />
        <FilterBar
          filters={filters}
          onChange={handleFilterChange}
          onBulkChange={handleBulkFilterChange}
          onReset={handleReset}
        />
      </Card>

      {/* Summary */}
      <Card className="p-0 overflow-hidden">
        <TransactionSummary
          summary={summary}
          isLoading={summaryLoading}
          splitMode={splitMode}
          onSplitModeChange={setSplitMode}
        />
      </Card>

      {/* Content */}
      {paginatedTxns.length === 0 ? (
        <EmptyState
          message="No transactions found"
          description="Try adjusting your filters or add a new transaction."
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
            </svg>
          }
          actionLabel="Add Transaction"
          onAction={() => navigate('/transactions/new')}
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          {/* Table header label */}
          <div className="flex items-center justify-between gap-3 px-4 md:px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900">Recent Activity</h2>
            <div className="flex items-center gap-3">
              <p className="text-xs text-gray-400">
                {paginatedTxns.length} of {filteredTransactions.length}
              </p>
              <button
                type="button"
                onClick={() => downloadTransactionsCSV(sortedTransactions)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                title={`Download ${sortedTransactions.length} filtered transactions as CSV`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
                </svg>
                CSV
              </button>
            </div>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden divide-y divide-gray-50">
            {paginatedTxns.map((txn) => (
              <TransactionCard
                key={txn.id}
                txn={txn}
                onClick={handleRowClick}
              />
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="py-3 pl-5 pr-3 text-left">
                    <SortableHeader
                      label="Date"
                      sortKey="date"
                      sortChain={sortChain}
                      onSort={handleSort}
                    />
                  </th>
                  <th className="py-3 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Description</th>
                  <th className="py-3 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 hidden lg:table-cell">Category</th>
                  <th className="py-3 px-3 text-right">
                    <SortableHeader
                      label="Amount"
                      sortKey="amount"
                      sortChain={sortChain}
                      onSort={handleSort}
                      align="right"
                    />
                  </th>
                  <th className="py-3 pl-3 pr-5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 hidden sm:table-cell">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedTxns.map((txn) => (
                  <TransactionRow
                    key={txn.id}
                    txn={txn}
                    onClick={handleRowClick}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="border-t border-gray-100 px-4 md:px-5 py-3">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        </Card>
      )}

      {/* Transaction detail modal */}
      <Modal
        isOpen={selectedTxn !== null}
        onClose={handleModalClose}
        title="Transaction Details"
        maxWidth="max-w-lg"
      >
        {selectedTxn && (
          <TransactionDetail
            transaction={selectedTxn}
            entries={getTransactionEntries(selectedTxn.id)}
            onClose={handleModalClose}
            onDeleted={() => { setSelectedTxn(null); }}
            onSelectTransaction={setSelectedTxn}
          />
        )}
      </Modal>
    </div>
  );
}
