const BASE_URL = '';

function getToken() {
  return localStorage.getItem('authToken');
}

function setToken(token) {
  localStorage.setItem('authToken', token);
}

function clearToken() {
  localStorage.removeItem('authToken');
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Token ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (res.status === 204) return null;

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(errorMessage(data) || `Request failed (${res.status})`);
  }

  return res.json();
}

// Normalize DRF error shapes into a readable sentence. Handles plain
// {detail}/{error} bodies and field-keyed validation errors like
// {"date": ["Books are closed …"], "amount": ["Required."]}.
function errorMessage(data) {
  if (!data || typeof data !== 'object') return null;
  if (typeof data.detail === 'string') return data.detail;
  if (typeof data.error === 'string') return data.error;

  const parts = [];
  for (const [field, value] of Object.entries(data)) {
    const text = Array.isArray(value) ? value.join(' ') : String(value);
    if (!text) continue;
    // Field names are noise when the message is already a sentence.
    const needsPrefix = field !== 'non_field_errors' && text.length < 40;
    parts.push(needsPrefix ? `${field}: ${text}` : text);
  }
  return parts.join(' ') || null;
}

// Like request() but returns the raw response body as a Blob (for CSV export).
async function requestBlob(path) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Token ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { headers });
  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.blob();
}

// Build a query string from a params object or URLSearchParams.
function qs(params) {
  if (!params) return '';
  const s = params instanceof URLSearchParams
    ? params.toString()
    : new URLSearchParams(params).toString();
  return s ? `?${s}` : '';
}

const api = {
  // Auth
  async login(username, password) {
    const data = await request('POST', '/api/auth/login/', { username, password });
    setToken(data.token);
    return data;
  },

  async register(username, password) {
    const data = await request('POST', '/api/auth/register/', { username, password });
    setToken(data.token);
    return data;
  },

  async logout() {
    try {
      await request('POST', '/api/auth/logout/');
    } finally {
      clearToken();
    }
  },

  getMe: () => request('GET', '/api/auth/me/'),

  // Bulk data
  getBootstrapData: () => request('GET', '/api/data/bootstrap/'),
  getAllData: () => request('GET', '/api/data/all/'),

  // Accounts (reference data arrives via bootstrap; only mutations here)
  createAccount: (data) => request('POST', '/api/accounts/', data),
  updateAccount: (id, data) => request('PATCH', `/api/accounts/${id}/`, data),
  deleteAccount: (id) => request('DELETE', `/api/accounts/${id}/`),

  // Categories
  createCategory: (data) => request('POST', '/api/categories/', data),
  updateCategory: (id, data) => request('PATCH', `/api/categories/${id}/`, data),
  deleteCategory: (id) => request('DELETE', `/api/categories/${id}/`),

  // Transactions
  getTransactions: (params) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', `/api/transactions/${qs ? '?' + qs : ''}`);
  },
  getTransaction: (id) => request('GET', `/api/transactions/${id}/`),
  createTransaction: (data) => request('POST', '/api/transactions/', data),
  updateTransaction: (id, data) => request('PUT', `/api/transactions/${id}/`, data),
  deleteTransaction: (id) => request('DELETE', `/api/transactions/${id}/`),
  getTransactionTags: () => request('GET', '/api/transactions/tags/'),
  getTransactionPlatforms: () => request('GET', '/api/transactions/platforms/'),
  getTransactionSummary: (params) => request('GET', `/api/transactions/summary/${qs(params)}`),

  // Aggregates / reports (all accept the same TransactionFilterSet params).
  getMonthlySpending: (params) => request('GET', `/api/transactions/monthly_spending/${qs(params)}`),
  getCategoryBreakdown: (params) => request('GET', `/api/transactions/category_breakdown/${qs(params)}`),
  getCashflow: (params) => request('GET', `/api/transactions/cashflow/${qs(params)}`),
  getSpendingTrends: (params) => request('GET', `/api/transactions/spending_trends/${qs(params)}`),
  getBeneficiaries: () => request('GET', '/api/transactions/beneficiaries/'),
  getTagCounts: () => request('GET', '/api/transactions/tag_counts/'),
  getTransactionsCSV: (params) => requestBlob(`/api/transactions/export/${qs(params)}`),

  // Account aggregates.
  getAccountBalances: () => request('GET', '/api/accounts/balances/'),
  getAccountLedger: (id) => request('GET', `/api/accounts/${id}/ledger/`),

  // Receivables rollup.
  getReceivablesRollup: () => request('GET', '/api/receivables/summary/'),

  // Receivables
  updateReceivable: (id, data) => request('PATCH', `/api/receivables/${id}/`, data),

  // Account Types
  getAccountTypes: () => request('GET', '/api/account-types/'),
  createAccountType: (data) => request('POST', '/api/account-types/', data),
  updateAccountType: (id, data) => request('PATCH', `/api/account-types/${id}/`, data),
  deleteAccountType: (id) => request('DELETE', `/api/account-types/${id}/`),

  // Account Sub-Types
  createAccountSubType: (data) => request('POST', '/api/account-sub-types/', data),
  updateAccountSubType: (id, data) => request('PATCH', `/api/account-sub-types/${id}/`, data),
  deleteAccountSubType: (id) => request('DELETE', `/api/account-sub-types/${id}/`),

  // Settings (read via bootstrap; write-only here)
  updateSetting: (key, value) => request('PUT', `/api/settings/${key}/`, { value }),

  // Backups
  listBackups: () => request('GET', '/api/backups/'),
  createBackup: () => request('POST', '/api/backups/'),

  // Book closes
  getBookCloses: () => request('GET', '/api/book-closes/'),
  createBookClose: (data) => request('POST', '/api/book-closes/', data),
  reopenBookClose: (id) => request('DELETE', `/api/book-closes/${id}/`),

  // SMS
  getSMSMessages: (params) => {
    let qs = '';
    if (params instanceof URLSearchParams) {
      qs = params.toString();
    } else if (params) {
      qs = new URLSearchParams(params).toString();
    }
    return request('GET', `/api/sms/${qs ? '?' + qs : ''}`);
  },
  getSMSDevices: () => request('GET', '/api/sms/devices/'),
  getSMSMessage: (id) => request('GET', `/api/sms/${id}/`),
  confirmSMS: (id, body) => request('POST', `/api/sms/${id}/confirm/`, body),
  linkSMS: (id, transactionId) =>
    request('POST', `/api/sms/${id}/link/`, { transaction_id: transactionId }),
  reparseSMS: (id) => request('POST', `/api/sms/${id}/reparse/`),
  ignoreSMS: (id) => request('POST', `/api/sms/${id}/ignore/`),
  // sinceDays: number of days back to include (1 = today), or 'all'/undefined
  // to parse every pending SMS regardless of age.
  parsePendingSMS: (sinceDays) => request(
    'POST', '/api/sms/parse-pending/',
    sinceDays && sinceDays !== 'all' ? { since_days: sinceDays } : {},
  ),

  // Token helpers (setToken stays internal to login/register)
  getToken,
  clearToken,
};

export default api;
