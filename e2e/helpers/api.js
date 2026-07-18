/**
 * Direct REST calls for test setup/teardown.
 *
 * Logging in via the UI is reserved for auth.setup.js (which exercises the
 * login form itself). Other tests use these helpers to skip the UI and
 * manipulate state quickly — much faster than driving the browser.
 */

const API_BASE = process.env.E2E_API_BASE || 'http://localhost:8000';
const USERNAME = process.env.E2E_USERNAME || 'e2e_user';
const PASSWORD = process.env.E2E_PASSWORD || 'e2e_password_123';

let cachedToken = null;

export async function getToken() {
  if (cachedToken) return cachedToken;
  const res = await fetch(`${API_BASE}/api/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  cachedToken = data.token;
  return cachedToken;
}

async function apiFetch(path, init = {}) {
  const token = await getToken();
  const headers = {
    Authorization: `Token ${token}`,
    'Content-Type': 'application/json',
    ...(init.headers ?? {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok && res.status !== 400 && res.status !== 404) {
    throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${await res.text()}`);
  }
  return res;
}

async function listAll(path) {
  const res = await apiFetch(path);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.results ?? []);
}

/**
 * Wipe per-test state. SAFE to call only against the disposable DB used by
 * scripts/e2e.sh (db_e2e.sqlite3). Categories and accounts are left alone —
 * those are seeded once and shared across all tests.
 *
 * Order matters: refunds (income with source_transaction) before expenses,
 * to avoid the source_transaction PROTECT cascade refusal.
 */
export async function resetState() {
  // Reopen any book-closes first: closed periods make transactions
  // read-only, which would silently block the deletes below.
  let closes = await listAll('/api/book-closes/');
  while (closes.length) {
    // Only the most recent close is deletable; peel newest-first.
    await apiFetch(`/api/book-closes/${closes[0].id}/`, { method: 'DELETE' });
    closes = await listAll('/api/book-closes/');
  }

  const txns = await listAll('/api/transactions/?page_size=500');
  const refunds = txns.filter((t) => t.source_transaction);
  const rest = txns.filter((t) => !t.source_transaction);
  for (const t of [...refunds, ...rest]) {
    await apiFetch(`/api/transactions/${t.id}/`, { method: 'DELETE' });
  }

  const sms = await listAll('/api/sms/?page_size=500');
  for (const s of sms) {
    await apiFetch(`/api/sms/${s.id}/`, { method: 'DELETE' });
  }
}

export async function postSMS({ sender, body, receivedAt, deviceIdentifier = 'phone1' }) {
  const res = await apiFetch('/api/sms/', {
    method: 'POST',
    body: JSON.stringify({
      sender,
      body,
      received_at: receivedAt,
      device_identifier: deviceIdentifier,
    }),
  });
  return res.json();
}

export async function getAccounts() {
  return listAll('/api/accounts/');
}

export async function getCategories() {
  return listAll('/api/categories/?page_size=200');
}

export async function deleteAllBackups() {
  const res = await apiFetch('/api/backups/');
  const items = await res.json();
  // No DELETE endpoint for backups; tests must tolerate pre-existing rows.
  return items;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export async function createExpense({
  amount, notes, accountId, categoryId, date = todayISO(), beneficiary = '',
}) {
  const res = await apiFetch('/api/transactions/', {
    method: 'POST',
    body: JSON.stringify({
      type: 'expense', date, amount, beneficiary,
      from_account_id: accountId, category_id: categoryId, notes,
    }),
  });
  return res.json();
}

export async function createSplitExpense({
  totalAmount, myShare, accountId, categoryId, receivableAccountId,
  receivables, date = todayISO(), notes = '',
}) {
  const res = await apiFetch('/api/transactions/', {
    method: 'POST',
    body: JSON.stringify({
      type: 'split_expense', date,
      total_amount: totalAmount, my_share: myShare,
      from_account_id: accountId, category_id: categoryId,
      receivable_account_id: receivableAccountId,
      receivables, notes,
    }),
  });
  return res.json();
}

export async function createRefund({ sourceId, amount, toAccountId, categoryId, date = todayISO(), notes = '' }) {
  const res = await apiFetch('/api/transactions/', {
    method: 'POST',
    body: JSON.stringify({
      type: 'income', date, amount,
      to_account_id: toAccountId, category_id: categoryId,
      source_transaction_id: sourceId, notes,
    }),
  });
  return res.json();
}

export async function getTransaction(id) {
  const res = await apiFetch(`/api/transactions/${id}/`);
  return res.json();
}

export async function getReceivablesForTransaction(transactionId) {
  const txn = await getTransaction(transactionId);
  return txn.receivables ?? [];
}

export async function patchSMS(id, data) {
  const res = await apiFetch(`/api/sms/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function listTransactions() {
  return listAll('/api/transactions/?page_size=500');
}
