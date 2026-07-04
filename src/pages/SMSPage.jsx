import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useUrlFilters } from '../hooks/useUrlFilters';
import Card from '../components/common/Card';
import Modal from '../components/common/Modal';
import MultiSelect from '../components/common/MultiSelect';
import CalendarPicker from '../components/common/CalendarPicker';
import EmptyState from '../components/common/EmptyState';
import LoadingSpinner from '../components/common/LoadingSpinner';
import SMSStatusBadge from '../components/sms/SMSStatusBadge';
import SMSDetailDrawer from '../components/sms/SMSDetailDrawer';
import TransactionDetail from '../components/transactions/TransactionDetail';
import { formatDate, formatINR } from '../utils/formatters';
import { effectiveSmsStatus } from '../utils/sms';

const STATUS_OPTIONS = [
  { value: 'pending',   label: 'Pending' },
  { value: 'parsed',    label: 'Parsed' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'failed',    label: 'Failed' },
  { value: 'ignored',   label: 'Ignored' },
];

const PARSE_WINDOW_LABELS = {
  1: 'today',
  3: '3 days',
  7: '7 days',
  30: '30 days',
  all: 'all',
};

const EMPTY_FILTERS = {
  statuses: [],     // default: show all statuses
  devices: [],
  dateFrom: '',
  dateTo: '',
  search: '',
};

// Schema for useUrlFilters — statuses/devices are repeated params, the rest
// are single-value strings.
const FILTER_SCHEMA = {
  statuses: { array: true },
  devices:  { array: true },
  dateFrom: {},
  dateTo:   {},
  search:   {},
};

function bodyPreview(body, max = 80) {
  if (!body) return '';
  const collapsed = body.replace(/\s+/g, ' ').trim();
  return collapsed.length > max ? collapsed.slice(0, max - 1) + '…' : collapsed;
}

export default function SMSPage() {
  // SMSPage no longer reads the global transactions/entries arrays; the linked
  // transaction modal self-fetches by id.

  const [smsMessages, setSmsMessages] = useState([]);
  const [devices, setDevices] = useState([]);
  // Filters are URL-backed: reload preserves them, links can be shared, and
  // browser back/forward works as expected.
  const [filters, setFilters] = useUrlFilters(FILTER_SCHEMA, EMPTY_FILTERS);
  // Debounced copy of filters.search — actual API trigger. Updates 300ms after
  // the user stops typing so we don't fire a request per keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [selectedSms, setSelectedSms] = useState(null);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  // How far back "Parse pending" reaches — avoids resurrecting a month-old
  // backlog by accident. Days as string, or 'all'. Today by default: parsing
  // is a daily ritual.
  const [parseWindow, setParseWindow] = useState('1');

  // Debounce search input → debouncedSearch
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(filters.search ?? ''), 300);
    return () => clearTimeout(id);
  }, [filters.search]);

  // Auto-clear the bulk-parse toast after 4s
  useEffect(() => {
    if (!bulkResult) return;
    const id = setTimeout(() => setBulkResult(null), 4000);
    return () => clearTimeout(id);
  }, [bulkResult]);

  const fetchSms = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const params = new URLSearchParams();
    for (const s of filters.statuses) params.append('status', s);
    for (const d of filters.devices) params.append('device_identifier', d);
    if (filters.dateFrom) params.set('date_from', filters.dateFrom);
    if (filters.dateTo)   params.set('date_to',   filters.dateTo);
    if (debouncedSearch)  params.set('search',    debouncedSearch);
    try {
      const data = await api.getSMSMessages(params);
      const items = Array.isArray(data) ? data : (data.results ?? []);
      setSmsMessages(items);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [filters.statuses, filters.devices, filters.dateFrom, filters.dateTo, debouncedSearch]);

  useEffect(() => { fetchSms(); }, [fetchSms]);

  useEffect(() => {
    api.getSMSDevices()
      .then((data) => setDevices(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  function onFilterChange(key, value) {
    setFilters({ [key]: value });
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
  }

  async function handleParsePending() {
    setBulkBusy(true);
    setBulkResult(null);
    try {
      const result = await api.parsePendingSMS(parseWindow);
      setBulkResult(result);
      await fetchSms();
    } catch (err) {
      setBulkResult({ error: err.message });
    } finally {
      setBulkBusy(false);
    }
  }

  function openConfirmDrawer(sms) {
    setSelectedSms(sms);
  }

  const deviceOptions = useMemo(
    () => devices.map((d) => ({ value: d, label: d })),
    [devices],
  );

  const hasActiveFilters = useMemo(() => {
    return (
      filters.statuses.length > 0 ||
      filters.devices.length > 0 ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.search
    );
  }, [filters]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold text-gray-900">SMS Messages</h1>
          <p className="text-sm text-gray-400 mt-1">
            Review parsed messages from your phones and confirm them into transactions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/sms/review"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
            </svg>
            Review
          </Link>
          {/* Split button: the label carries the window ("Parse today"), so the
              dropdown segment is chevron-only — an invisible select sits over it. */}
          <div className="shrink-0 inline-flex items-stretch rounded-xl border border-gray-200 bg-white overflow-hidden">
            <button
              onClick={handleParsePending}
              disabled={bulkBusy}
              className="inline-flex items-center gap-2 pl-4 pr-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-accent" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              {bulkBusy ? 'Queueing…' : `Parse ${PARSE_WINDOW_LABELS[parseWindow]}`}
            </button>
            <span className="w-px self-stretch bg-gray-200" aria-hidden="true" />
            <div className="relative inline-flex items-center px-2 hover:bg-gray-50 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
              <select
                value={parseWindow}
                onChange={(e) => setParseWindow(e.target.value)}
                aria-label="How far back to parse"
                className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
              >
                <option value="1">Today</option>
                <option value="3">Last 3 days</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="all">All time</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk result toast — parses run in the background queue, so the
          response just reports how many were queued, not the outcome. */}
      {bulkResult && !bulkResult.error && (
        <div className="rounded-xl border border-accent/30 bg-accent-light/30 px-4 py-2.5 text-xs text-brand">
          {bulkResult.queued > 0
            ? `Queued ${bulkResult.queued} SMS for parsing — refresh in a moment to see results.`
            : 'No pending SMS to parse.'}
        </div>
      )}
      {bulkResult?.error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-700">
          {bulkResult.error}
        </div>
      )}

      {/* Filters */}
      <Card className="px-5 py-4 overflow-visible">
        <div className="flex flex-wrap items-center gap-2.5 py-1">
          <MultiSelect
            value={filters.statuses}
            onChange={(arr) => onFilterChange('statuses', arr)}
            options={STATUS_OPTIONS}
            placeholder="All statuses"
            singularLabel="status"
            className="flex-1 min-w-[calc(50%-0.375rem)] sm:min-w-[160px] sm:flex-none"
          />
          {deviceOptions.length > 0 && (
            <MultiSelect
              value={filters.devices}
              onChange={(arr) => onFilterChange('devices', arr)}
              options={deviceOptions}
              placeholder="All devices"
              singularLabel="device"
              className="flex-1 min-w-[calc(50%-0.375rem)] sm:min-w-[150px] sm:flex-none"
            />
          )}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <CalendarPicker
              value={filters.dateFrom}
              onChange={(val) => onFilterChange('dateFrom', val)}
              placeholder="From"
              compact
              className="flex-1 sm:flex-none"
            />
            <span className="text-gray-300 text-sm">→</span>
            <CalendarPicker
              value={filters.dateTo}
              onChange={(val) => onFilterChange('dateTo', val)}
              placeholder="To"
              min={filters.dateFrom || undefined}
              compact
              className="flex-1 sm:flex-none"
            />
          </div>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onFilterChange('search', e.target.value)}
            placeholder="Search body..."
            className="flex-1 min-w-[calc(50%-0.375rem)] sm:min-w-[180px] sm:flex-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Reset
            </button>
          )}
        </div>
      </Card>

      {/* Body */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <Card className="px-5 py-6 text-sm text-rose-600">{error}</Card>
      ) : smsMessages.length === 0 ? (
        <EmptyState
          message="No SMS messages match these filters."
          description="Try clearing the filters, or wait for new SMS to come in from your phone."
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="py-3 pl-5 pr-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Date</th>
                  <th className="py-3 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Sender</th>
                  <th className="py-3 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Body</th>
                  <th className="py-3 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Device</th>
                  <th className="py-3 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Status</th>
                  <th className="py-3 pl-3 pr-5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {smsMessages.map((sms) => (
                  <SMSRow key={sms.id} sms={sms} onClick={openConfirmDrawer} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-50">
            {smsMessages.map((sms) => (
              <SMSCard key={sms.id} sms={sms} onClick={openConfirmDrawer} />
            ))}
          </div>
        </Card>
      )}

      {/* Confirm drawer */}
      <Modal
        isOpen={selectedSms !== null}
        onClose={() => setSelectedSms(null)}
        title="Confirm SMS as Transaction"
        maxWidth="max-w-lg"
      >
        {selectedSms && (
          <SMSDetailDrawer
            sms={selectedSms}
            onClose={() => setSelectedSms(null)}
            onSuccess={() => { setSelectedSms(null); fetchSms(); }}
            onViewLinkedTransaction={(txnId) => {
              if (txnId) {
                setSelectedSms(null);
                // TransactionDetail self-fetches the full record from this seed.
                setSelectedTxn({ id: txnId });
              }
            }}
          />
        )}
      </Modal>

      {/* Linked transaction modal */}
      <Modal
        isOpen={selectedTxn !== null}
        onClose={() => setSelectedTxn(null)}
        title="Transaction Details"
        maxWidth="max-w-lg"
      >
        {selectedTxn && (
          <TransactionDetail
            transaction={selectedTxn}
            onClose={() => setSelectedTxn(null)}
            onDeleted={() => { setSelectedTxn(null); fetchSms(); }}
            onSelectTransaction={setSelectedTxn}
          />
        )}
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row (desktop)
// ---------------------------------------------------------------------------

function SMSRow({ sms, onClick }) {
  const date = sms.received_at ? formatDate(sms.received_at) : '';

  return (
    <tr
      tabIndex={0}
      onClick={() => onClick(sms)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(sms); } }}
      className="hover:bg-gray-50/80 cursor-pointer transition-colors"
    >
      <td className="py-3 pl-5 pr-3 whitespace-nowrap text-sm text-gray-700">{date}</td>
      <td className="py-3 px-3 text-sm text-gray-700 whitespace-nowrap">{sms.sender}</td>
      <td className="py-3 px-3 text-sm text-gray-600 max-w-md break-words">{bodyPreview(sms.body, 100)}</td>
      <td className="py-3 px-3 text-xs text-gray-500 whitespace-nowrap">{sms.device_identifier || '—'}</td>
      <td className="py-3 px-3"><SMSStatusBadge status={effectiveSmsStatus(sms)} /></td>
      <td className="py-3 pl-3 pr-5 text-right text-sm font-medium text-gray-700 tabular-nums whitespace-nowrap">
        {sms.parsed_amount ? formatINR(sms.parsed_amount) : '—'}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Card (mobile)
// ---------------------------------------------------------------------------

function SMSCard({ sms, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(sms)}
      className="w-full text-left px-4 py-3 space-y-2 hover:bg-gray-50/80 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(sms.received_at)}</span>
          <span className="text-xs font-semibold text-gray-700 truncate">{sms.sender}</span>
          {sms.device_identifier && (
            <span className="text-[10px] text-gray-400">· {sms.device_identifier}</span>
          )}
        </div>
        <SMSStatusBadge status={effectiveSmsStatus(sms)} />
      </div>
      <p className="text-xs text-gray-600 break-words">{bodyPreview(sms.body, 140)}</p>
      <div className="flex items-center justify-end">
        <span className="text-sm font-semibold tabular-nums text-gray-700">
          {sms.parsed_amount ? formatINR(sms.parsed_amount) : '—'}
        </span>
      </div>
    </button>
  );
}
