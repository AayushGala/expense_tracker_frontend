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
    const msg = data.detail || data.error || JSON.stringify(data);
    throw new Error(msg);
  }

  return res.json();
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
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  del: (path) => request('DELETE', path),

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

  // Accounts
  getAccounts: () => request('GET', '/api/accounts/'),
  createAccount: (data) => request('POST', '/api/accounts/', data),
  updateAccount: (id, data) => request('PATCH', `/api/accounts/${id}/`, data),
  deleteAccount: (id) => request('DELETE', `/api/accounts/${id}/`),

  // Categories
  getCategories: (params) => {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return request('GET', `/api/categories/${qs ? '?' + qs : ''}`);
  },
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
  getReceivables: (params) => {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return request('GET', `/api/receivables/${qs ? '?' + qs : ''}`);
  },
  updateReceivable: (id, data) => request('PATCH', `/api/receivables/${id}/`, data),

  // Budgets
  getBudgets: () => request('GET', '/api/budgets/'),
  createBudget: (data) => request('POST', '/api/budgets/', data),
  updateBudget: (id, data) => request('PATCH', `/api/budgets/${id}/`, data),
  deleteBudget: (id) => request('DELETE', `/api/budgets/${id}/`),

  // Account Types
  getAccountTypes: () => request('GET', '/api/account-types/'),
  createAccountType: (data) => request('POST', '/api/account-types/', data),
  updateAccountType: (id, data) => request('PATCH', `/api/account-types/${id}/`, data),
  deleteAccountType: (id) => request('DELETE', `/api/account-types/${id}/`),

  // Account Sub-Types
  getAccountSubTypes: (params) => {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return request('GET', `/api/account-sub-types/${qs ? '?' + qs : ''}`);
  },
  createAccountSubType: (data) => request('POST', '/api/account-sub-types/', data),
  updateAccountSubType: (id, data) => request('PATCH', `/api/account-sub-types/${id}/`, data),
  deleteAccountSubType: (id) => request('DELETE', `/api/account-sub-types/${id}/`),

  // Settings
  getSettings: () => request('GET', '/api/settings/'),
  updateSetting: (key, value) => request('PUT', `/api/settings/${key}/`, { value }),

  // Backups
  listBackups: () => request('GET', '/api/backups/'),
  createBackup: () => request('POST', '/api/backups/'),

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
  reparseSMS: (id) => request('POST', `/api/sms/${id}/reparse/`),
  ignoreSMS: (id) => request('POST', `/api/sms/${id}/ignore/`),
  // sinceDays: number of days back to include (1 = today), or 'all'/undefined
  // to parse every pending SMS regardless of age.
  parsePendingSMS: (sinceDays) => request(
    'POST', '/api/sms/parse-pending/',
    sinceDays && sinceDays !== 'all' ? { since_days: sinceDays } : {},
  ),

  // Token helpers
  getToken,
  setToken,
  clearToken,
};

export default api;
