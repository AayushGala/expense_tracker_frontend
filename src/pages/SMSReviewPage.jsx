import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Select from '../components/common/Select';
import SMSStatusBadge from '../components/sms/SMSStatusBadge';
import AccountPicker from '../components/forms/AccountPicker';
import AmountInput from '../components/forms/AmountInput';
import CategoryPicker from '../components/forms/CategoryPicker';
import DateField from '../components/forms/DateField';
import { inputClass, labelClass } from '../utils/formStyles';
import { transactionTypeLabel } from '../utils/formatters';
import { isDateClosed } from '../utils/bookClose';
import { formatINR } from '../utils/formatters';
import { effectiveSmsStatus } from '../utils/sms';
import {
  CONFIRM_TYPES,
  CARD_EDITABLE_TYPES,
  TYPES_WITH_CATEGORY,
  TYPES_WITH_FROM_ACCOUNT,
  TYPES_WITH_TO_ACCOUNT,
  buildConfirmPayload,
  buildTransactionPayload,
  valuesFromParsedSms,
  valuesFromTransaction,
  windowDateFrom,
  REVIEW_WINDOWS,
} from '../utils/smsReview';

const MAX_PAGES = 4; // safety cap: 4 × 50 messages per window

/**
 * End-of-day review: one SMS per card, newest window first configurable.
 * Swipe (or arrows) to move; the linked transaction's from-account /
 * to-account / category / owner are big native selects that save on change —
 * no separate transaction screen needed.
 */
export default function SMSReviewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawSince = searchParams.get('since');
  const since = REVIEW_WINDOWS.some((w) => w.value === rawSince) ? rawSince : '1';

  const [items, setItems] = useState([]);
  const [index, setIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      const dateFrom = windowDateFrom(since);
      if (dateFrom) params.set('date_from', dateFrom);
      // Everything except ignored — confirmed stays reviewable.
      for (const s of ['pending', 'parsed', 'confirmed', 'failed']) {
        params.append('status', s);
      }
      let results = [];
      let page = 1;
      // The API paginates at 50; follow pages up to the cap.
      for (; page <= MAX_PAGES; page++) {
        params.set('page', String(page));
        const data = await api.getSMSMessages(params);
        const batch = Array.isArray(data) ? data : (data.results ?? []);
        results = results.concat(batch);
        if (Array.isArray(data) || !data.next) break;
      }
      // Chronological: review the day in the order it happened.
      results.sort((a, b) => (a.received_at < b.received_at ? -1 : 1));
      setItems(results);
      setIndex(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [since]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const current = items[index] ?? null;

  function setSince(value) {
    setSearchParams(value === '1' ? {} : { since: value });
  }

  function goto(delta) {
    setIndex((i) => Math.min(Math.max(i + delta, 0), items.length - 1));
  }

  function handleSmsUpdated(updated) {
    setItems((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
  }

  function handleIgnored(id) {
    setItems((prev) => {
      const next = prev.filter((s) => s.id !== id);
      setIndex((i) => Math.min(i, Math.max(next.length - 1, 0)));
      return next;
    });
  }

  return (
    <div className="max-w-lg mx-auto space-y-3">
      {/* Window chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1">
        {REVIEW_WINDOWS.map((w) => (
          <button
            key={w.value}
            onClick={() => setSince(w.value)}
            className={`shrink-0 inline-flex items-center rounded-xl border px-4 py-2 text-sm font-semibold transition-all duration-150 ${
              since === w.value
                ? 'bg-accent-light text-brand border-accent shadow-sm'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {w.label}
          </button>
        ))}
        <Link to="/sms" className="ml-auto shrink-0 text-xs font-medium text-accent hover:underline">
          List view
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24"><LoadingSpinner /></div>
      ) : error ? (
        <div className="bg-white rounded-2xl border border-rose-200 p-6 text-sm text-rose-600">{error}</div>
      ) : !current ? (
        <div className="bg-white rounded-2xl border border-gray-200 py-16 px-6 text-center">
          <p className="text-3xl mb-2">🎉</p>
          <p className="text-sm font-semibold text-gray-700">All caught up</p>
          <p className="mt-1 text-xs text-gray-400">No SMS to review in this window.</p>
        </div>
      ) : (
        <ReviewCard
          key={current.id}
          sms={current}
          position={index + 1}
          total={items.length}
          onPrev={index > 0 ? () => goto(-1) : null}
          onNext={index < items.length - 1 ? () => goto(1) : null}
          onSmsUpdated={handleSmsUpdated}
          onIgnored={handleIgnored}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function ReviewCard({ sms, position, total, onPrev, onNext, onSmsUpdated, onIgnored }) {
  const { accounts, categories, settings, confirmSMS, invalidate, book_closed_through } = useData();
  const toast = useToast();

  const isLinked = !!sms.transaction;
  const [txn, setTxn] = useState(null);
  const [values, setValues] = useState(() => (isLinked ? null : valuesFromParsedSms(sms)));
  const [busy, setBusy] = useState(false);
  // Possible duplicates: same amount+direction ±1 day on any account. The
  // detail endpoint computes them; dismissing shows the normal confirm form.
  const [duplicates, setDuplicates] = useState([]);
  const [dupesDismissed, setDupesDismissed] = useState(false);
  const touch = useRef({ x: 0, y: 0 });

  // Linked card: load the transaction and derive editable values from entries.
  useEffect(() => {
    if (!isLinked) return;
    let cancelled = false;
    api.getTransaction(sms.transaction).then((data) => {
      if (cancelled) return;
      setTxn(data);
      setValues(valuesFromTransaction(data));
    }).catch((err) => { if (!cancelled) toast.error(err.message); });
    return () => { cancelled = true; };
  }, [sms.transaction]); // eslint-disable-line react-hooks/exhaustive-deps

  // Unlinked card: check for possible duplicate transactions.
  useEffect(() => {
    if (isLinked) return;
    let cancelled = false;
    api.getSMSMessage(sms.id).then((data) => {
      if (!cancelled) setDuplicates(data.possible_duplicates ?? []);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [sms.id, isLinked]);

  const usableAccounts = useMemo(
    () => accounts.filter((a) => (a.type === 'asset' || a.type === 'liability') && a.is_active !== false),
    [accounts],
  );
  const owners = useMemo(
    () => (settings.owners ?? '').split(',').map((o) => o.trim()).filter(Boolean),
    [settings.owners],
  );
  const cardType = values?.type ?? 'expense';
  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === (cardType === 'income' ? 'income' : 'expense')),
    [categories, cardType],
  );

  const inClosedBooks = isLinked && txn && isDateClosed(txn.date, book_closed_through);
  const editable = (!isLinked || (txn && CARD_EDITABLE_TYPES.has(txn.type))) && !inClosedBooks;

  // Save the linked transaction with the given values (full payload so entry
  // regeneration has everything it needs).
  async function saveTxn(nextValues) {
    setBusy(true);
    try {
      const payload = buildTransactionPayload(nextValues, accounts);
      const updated = await api.updateTransaction(txn.id, payload);
      setTxn(updated);
      setValues(valuesFromTransaction(updated));
      invalidate();
      toast.success('Saved');
    } catch (err) {
      toast.error(err.message);
      // Reset to the server's state so the card never shows unsaved values.
      setValues(valuesFromTransaction(txn));
    } finally {
      setBusy(false);
    }
  }

  // Selects auto-save immediately for linked cards; text/amount/date commit on blur.
  function changeField(name, value, { autosave } = {}) {
    const next = { ...values, [name]: value };
    setValues(next);
    if (isLinked && autosave && txn) saveTxn(next);
  }

  function commitField() {
    if (isLinked && txn) saveTxn(values);
  }

  async function handleConfirm() {
    setBusy(true);
    try {
      const created = await confirmSMS(sms.id, buildConfirmPayload(values));
      toast.success('Transaction created');
      onSmsUpdated({ id: sms.id, status: 'confirmed', transaction: created.id });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLink(duplicate) {
    setBusy(true);
    try {
      await api.linkSMS(sms.id, duplicate.id);
      invalidate();
      toast.success(`Linked to transaction #${duplicate.id}`);
      onSmsUpdated({ id: sms.id, status: 'confirmed', transaction: duplicate.id });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleIgnore() {
    setBusy(true);
    try {
      await api.ignoreSMS(sms.id);
      toast.success('Ignored');
      onIgnored(sms.id);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  function onTouchStart(e) {
    touch.current = { x: e.changedTouches[0].screenX, y: e.changedTouches[0].screenY };
  }

  function onTouchEnd(e) {
    const t = e.changedTouches[0];
    const dx = t.screenX - touch.current.x;
    const dy = Math.abs(t.screenY - touch.current.y);
    if (Math.abs(dx) > 70 && dy < 60) {
      if (dx < 0) onNext?.();
      else onPrev?.();
    }
  }


  return (
    <div
      className="bg-white rounded-2xl border border-gray-200 overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 pt-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">{sms.sender}</p>
          <p className="text-xs text-gray-400">
            {new Date(sms.received_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            {sms.device_identifier ? ` · ${sms.device_identifier}` : ''}
          </p>
        </div>
        <SMSStatusBadge status={effectiveSmsStatus(sms)} />
      </div>

      {/* SMS body */}
      <div className="mx-4 mt-3 rounded-xl bg-gray-50 border border-gray-100 px-3.5 py-3 text-[13px] leading-relaxed text-gray-700 max-h-36 overflow-y-auto whitespace-pre-line">
        {sms.body}
      </div>

      {sms.parse_errors && (
        <p className="mx-4 mt-2 text-xs text-amber-600">{sms.parse_errors}</p>
      )}

      {/* Transaction form */}
      <div className="px-4 pb-4 pt-3">
        {isLinked && !txn ? (
          <div className="flex justify-center py-6"><LoadingSpinner /></div>
        ) : !editable ? (
          <div className="rounded-xl border border-gray-200 p-3 text-sm">
            <p className="font-semibold">{txn.type.replace('_', ' ')} · {txn.date}</p>
            {inClosedBooks ? (
              <p className="mt-1 text-xs text-gray-400">
                🔒 In closed books — record corrections as new transactions.
              </p>
            ) : (
              <Link to={`/transactions/${txn.id}/edit`} className="mt-1 inline-block text-accent font-medium hover:underline">
                Edit in full form →
              </Link>
            )}
          </div>
        ) : values && (
          <div className="space-y-4">
            {!isLinked && duplicates.length > 0 && !dupesDismissed && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                <p className="text-xs font-semibold text-amber-800">
                  Possible duplicate — {duplicates.length === 1 ? 'a transaction' : 'transactions'} with
                  this amount already {duplicates.length === 1 ? 'exists' : 'exist'}:
                </p>
                {duplicates.map((dup) => (
                  <div key={dup.id} className="flex items-center justify-between gap-2 rounded-lg bg-white border border-amber-100 px-3 py-2">
                    <div className="min-w-0 text-xs text-gray-600">
                      <span className="font-semibold text-gray-800">
                        {formatINR(dup.amount)}
                      </span>
                      {' · '}{dup.beneficiary || dup.type}
                      {dup.account_names?.length > 0 && ` · ${dup.account_names.join(', ')}`}
                      {' · '}{dup.date}
                    </div>
                    <button
                      onClick={() => handleLink(dup)}
                      disabled={busy}
                      className="shrink-0 rounded-lg bg-brand px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
                    >
                      Link to this
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setDupesDismissed(true)}
                  className="text-xs font-medium text-amber-700 hover:underline"
                >
                  It's a different transaction — create a new one
                </button>
              </div>
            )}

            {!isLinked && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
                {CONFIRM_TYPES.map((t) => {
                  const isSelected = values.type === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setValues({ ...values, type: t.value })}
                      className={`flex-shrink-0 inline-flex items-center rounded-xl px-4 py-2 text-sm font-semibold border transition-all duration-150 ${
                        isSelected
                          ? 'bg-accent-light text-brand border-accent shadow-sm'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {transactionTypeLabel(t.value)}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {/* onBlur bubbles from the input, committing typed edits on linked cards */}
              <div onBlur={commitField}>
                <AmountInput
                  variant="compact"
                  id={`review-amount-${sms.id}`}
                  value={values.amount}
                  onChange={(val) => changeField('amount', val)}
                />
              </div>
              <DateField
                value={values.date}
                onChange={(val) => changeField('date', val, { autosave: true })}
              />
            </div>

            {TYPES_WITH_FROM_ACCOUNT.has(cardType) && (
              <AccountPicker
                label={cardType === 'expense' ? 'Paid from' : 'From account'}
                value={values.from_account_id}
                accounts={usableAccounts}
                onChange={(accountId) => changeField('from_account_id', accountId, { autosave: true })}
              />
            )}

            {TYPES_WITH_TO_ACCOUNT.has(cardType) && (
              <AccountPicker
                label="To account"
                value={values.to_account_id}
                accounts={usableAccounts}
                onChange={(accountId) => changeField('to_account_id', accountId, { autosave: true })}
              />
            )}

            {TYPES_WITH_CATEGORY.has(cardType) && (
              <CategoryPicker
                value={values.category_id}
                categories={filteredCategories}
                onChange={(categoryId) => changeField('category_id', categoryId, { autosave: true })}
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Owner"
                value={values.owner}
                onChange={(e) => changeField('owner', e.target.value, { autosave: true })}
                options={owners.map((o) => ({ value: o, label: o }))}
                placeholder="Auto (from account)"
              />
              <div onBlur={commitField}>
                <label className={labelClass}>Beneficiary</label>
                <input
                  type="text"
                  value={values.beneficiary}
                  onChange={(e) => changeField('beneficiary', e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            {!isLinked ? (
              // While the duplicate banner is up, Link/dismiss are the choices;
              // Confirm only returns once the user says it's a new transaction.
              (duplicates.length === 0 || dupesDismissed) && (
                <button
                  onClick={handleConfirm}
                  disabled={busy}
                  className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50 transition-colors"
                >
                  {busy ? 'Saving…' : 'Confirm transaction'}
                </button>
              )
            ) : (
              <p className="text-center text-[11px] text-gray-400">
                {busy ? 'Saving…' : 'Changes save automatically'} ·{' '}
                <Link to={`/transactions/${txn?.id}/edit`} className="text-accent hover:underline">full form</Link>
              </p>
            )}
          </div>
        )}

        {/* Secondary actions */}
        <div className="mt-3 flex items-center justify-center gap-4 text-xs font-medium">
          {!isLinked ? (
            <button onClick={handleIgnore} disabled={busy} className="text-gray-400 hover:text-red-500">
              Ignore
            </button>
          ) : (
            <span className="text-gray-300">Linked to transaction #{sms.transaction}</span>
          )}
        </div>
      </div>

      {/* Prev / position / next */}
      <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-2 py-1.5">
        <button
          onClick={onPrev ?? undefined} disabled={!onPrev}
          className={`rounded-lg px-4 py-2 text-lg ${onPrev ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-300'}`}
        >‹</button>
        <span className="text-xs font-semibold text-gray-500">{position} of {total}</span>
        <button
          onClick={onNext ?? undefined} disabled={!onNext}
          className={`rounded-lg px-4 py-2 text-lg ${onNext ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-300'}`}
        >›</button>
      </div>
    </div>
  );
}
