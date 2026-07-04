// Helpers for the SMS review flow (/sms/review): windowing, deriving editable
// form values from an existing transaction's entries, and building API
// payloads. Pure functions — tested in smsReview.test.js.

export const REVIEW_WINDOWS = [
  { value: '1', label: 'Today', days: 1 },
  { value: '3', label: '3 days', days: 3 },
  { value: '7', label: '7 days', days: 7 },
  { value: '30', label: '30 days', days: 30 },
  { value: 'all', label: 'All time', days: null },
];

export const CONFIRM_TYPES = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'bill_payment', label: 'Bill Pay' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'investment', label: 'Invest' },
];

export const TYPES_WITH_FROM_ACCOUNT = new Set(['expense', 'transfer', 'bill_payment', 'investment']);
export const TYPES_WITH_TO_ACCOUNT = new Set(['income', 'transfer', 'bill_payment', 'investment']);
export const TYPES_WITH_CATEGORY = new Set(['expense', 'income']);

// Types the review card can edit inline; split/reimbursement go to the full form.
export const CARD_EDITABLE_TYPES = new Set(CONFIRM_TYPES.map((t) => t.value));

function localISODate(d) {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

// date_from param for a window value ('' = no lower bound). Day-based and
// inclusive: '1' = today, '3' = today and the two days before.
export function windowDateFrom(value, today = new Date()) {
  const win = REVIEW_WINDOWS.find((w) => w.value === value);
  if (!win || win.days == null) return '';
  const from = new Date(today);
  from.setDate(from.getDate() - (win.days - 1));
  return localISODate(from);
}

// Reverse-engineer editable values from a transaction detail (mirrors the
// backend's entry layout per type: DEBIT/CREDIT rows with account XOR category).
export function valuesFromTransaction(txn) {
  const entries = txn.entries ?? [];
  const acctDebit = entries.find((e) => e.entry_type === 'DEBIT' && e.account_id);
  const acctCredit = entries.find((e) => e.entry_type === 'CREDIT' && e.account_id);
  const catDebit = entries.find((e) => e.entry_type === 'DEBIT' && e.category_id);

  const values = {
    type: txn.type,
    date: txn.date,
    amount: '',
    from_account_id: '',
    to_account_id: '',
    category_id: txn.category ? String(txn.category) : '',
    owner: txn.owner ?? '',
    beneficiary: txn.beneficiary ?? '',
    description: txn.description ?? '',
    platform: txn.platform ?? '',
    tags: txn.tags ?? '',
    notes: txn.notes ?? '',
    fee: '',
    fee_category_id: '',
    source_transaction_id: txn.source_transaction ? String(txn.source_transaction) : '',
  };

  if (txn.type === 'expense') {
    values.amount = catDebit?.amount ?? '';
    values.from_account_id = acctCredit ? String(acctCredit.account_id) : '';
  } else if (txn.type === 'income') {
    values.amount = acctDebit?.amount ?? '';
    values.to_account_id = acctDebit ? String(acctDebit.account_id) : '';
  } else if (['transfer', 'bill_payment', 'investment'].includes(txn.type)) {
    values.amount = acctDebit?.amount ?? '';
    values.to_account_id = acctDebit ? String(acctDebit.account_id) : '';
    values.from_account_id = acctCredit ? String(acctCredit.account_id) : '';
    if (txn.type === 'transfer' && catDebit) {
      values.fee = catDebit.amount;
      values.fee_category_id = String(catDebit.category_id);
    }
  }
  return values;
}

// Owner for the payload: explicit selection wins, otherwise the owner of the
// account the money moved through (to-account for income, else from-account).
export function resolveOwner(values, accounts) {
  if (values.owner) return values.owner;
  const accountId = values.type === 'income'
    ? values.to_account_id
    : values.from_account_id;
  if (!accountId) return '';
  const account = accounts.find((a) => String(a.id) === String(accountId));
  return account?.owner ?? '';
}

function putInt(payload, key, value) {
  const n = parseInt(value, 10);
  if (!Number.isNaN(n)) payload[key] = n;
}

// Full PUT payload for editing a linked transaction. Text fields are always
// present (the serializer would blank them anyway if omitted), structural
// fields only when set so validation errors are precise.
export function buildTransactionPayload(values, accounts) {
  const payload = {
    type: values.type,
    date: values.date,
    amount: String(values.amount),
    owner: resolveOwner(values, accounts),
    beneficiary: values.beneficiary ?? '',
    description: values.description ?? '',
    platform: values.platform ?? '',
    tags: values.tags ?? '',
    notes: values.notes ?? '',
  };
  if (TYPES_WITH_FROM_ACCOUNT.has(values.type)) putInt(payload, 'from_account_id', values.from_account_id);
  if (TYPES_WITH_TO_ACCOUNT.has(values.type)) putInt(payload, 'to_account_id', values.to_account_id);
  if (TYPES_WITH_CATEGORY.has(values.type)) putInt(payload, 'category_id', values.category_id);
  if (values.type === 'transfer' && values.fee) {
    payload.fee = String(values.fee);
    putInt(payload, 'fee_category_id', values.fee_category_id);
  }
  if (values.source_transaction_id) putInt(payload, 'source_transaction_id', values.source_transaction_id);
  return payload;
}

// Confirm payload for an unlinked SMS (SMSConfirmSerializer). Empty values are
// omitted so the serializer's parsed_* fallbacks and owner derivation apply.
export function buildConfirmPayload(values) {
  const payload = { type: values.type };
  if (values.amount) payload.amount = String(values.amount);
  if (values.date) payload.date = values.date;
  if (TYPES_WITH_FROM_ACCOUNT.has(values.type)) putInt(payload, 'from_account_id', values.from_account_id);
  if (TYPES_WITH_TO_ACCOUNT.has(values.type)) putInt(payload, 'to_account_id', values.to_account_id);
  if (TYPES_WITH_CATEGORY.has(values.type)) putInt(payload, 'category_id', values.category_id);
  if (values.beneficiary) payload.beneficiary = values.beneficiary;
  if (values.owner) payload.owner = values.owner;
  if (values.notes) payload.notes = values.notes;
  return payload;
}

// Initial card values for an unconfirmed SMS from its parsed_* fields.
export function valuesFromParsedSms(sms, today = new Date()) {
  const supported = CONFIRM_TYPES.some((t) => t.value === sms.parsed_type);
  const type = supported
    ? sms.parsed_type
    : (sms.parsed_direction === 'credit' ? 'income' : 'expense');
  return {
    type,
    amount: sms.parsed_amount ?? '',
    date: sms.parsed_date ?? localISODate(today),
    from_account_id: sms.parsed_account ? String(sms.parsed_account) : '',
    to_account_id: sms.parsed_to_account ? String(sms.parsed_to_account) : '',
    category_id: sms.parsed_category ? String(sms.parsed_category) : '',
    owner: '',
    beneficiary: sms.parsed_beneficiary ?? '',
    notes: '',
  };
}
