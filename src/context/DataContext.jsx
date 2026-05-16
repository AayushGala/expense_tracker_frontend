import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import api from '../api/client';
import { D } from '../utils/money';

const initialState = {
  accounts: [],
  categories: [],
  transactions: [],
  entries: [],
  receivables: [],
  budgets: [],
  accountTypes: [],
  settings: {},
  isLoading: true,
  error: null,
};

const SET_DATA            = 'SET_DATA';
const SET_LOADING         = 'SET_LOADING';
const SET_ERROR           = 'SET_ERROR';
const ADD_TRANSACTION     = 'ADD_TRANSACTION';
const UPDATE_TRANSACTION  = 'UPDATE_TRANSACTION';
const DELETE_TRANSACTION  = 'DELETE_TRANSACTION';
const ADD_ACCOUNT         = 'ADD_ACCOUNT';
const UPDATE_ACCOUNT      = 'UPDATE_ACCOUNT';
const DELETE_ACCOUNT      = 'DELETE_ACCOUNT';
const ADD_CATEGORY        = 'ADD_CATEGORY';
const UPDATE_CATEGORY     = 'UPDATE_CATEGORY';
const DELETE_CATEGORY     = 'DELETE_CATEGORY';
const ADD_RECEIVABLE      = 'ADD_RECEIVABLE';
const UPDATE_RECEIVABLE   = 'UPDATE_RECEIVABLE';
const SET_ACCOUNT_TYPES   = 'SET_ACCOUNT_TYPES';
const SET_SETTINGS        = 'SET_SETTINGS';

function dataReducer(state, action) {
  switch (action.type) {
    case SET_DATA: {
      const { settings, ...rest } = action.payload;
      // settings may be an object already (from Django) or an array (legacy)
      const settingsObj = Array.isArray(settings)
        ? settings.reduce((acc, { key, value }) => { acc[key] = value; return acc; }, {})
        : (settings ?? {});
      return {
        ...state,
        ...rest,
        accountTypes: state.accountTypes,
        settings: settingsObj,
        isLoading: false,
        error: null,
      };
    }

    case SET_LOADING:
      return { ...state, isLoading: action.payload };

    case SET_ERROR:
      return { ...state, error: action.payload, isLoading: false };

    // --- Transactions ---

    case ADD_TRANSACTION: {
      const { transaction, entries, receivables = [] } = action.payload;
      return {
        ...state,
        transactions: [...state.transactions, transaction],
        entries: [...state.entries, ...entries],
        receivables: [...state.receivables, ...receivables],
      };
    }

    case UPDATE_TRANSACTION: {
      const { id, transaction, newEntries, newReceivables } = action.payload;
      const transactions = state.transactions.map((t) =>
        t.id === id ? { ...t, ...transaction } : t
      );
      const entriesWithoutOld = state.entries.filter((e) => e.transaction_id !== id);
      // Split-expense edits replace the receivables. For other types,
      // newReceivables is undefined and we leave them untouched.
      const receivables = newReceivables !== undefined
        ? [...state.receivables.filter((r) => r.transaction_id !== id), ...newReceivables]
        : state.receivables;
      return {
        ...state,
        transactions,
        entries: [...entriesWithoutOld, ...newEntries],
        receivables,
      };
    }

    case DELETE_TRANSACTION: {
      const { id } = action.payload;
      return {
        ...state,
        transactions: state.transactions.filter((t) => t.id !== id),
        entries: state.entries.filter((e) => e.transaction_id !== id),
        // Cascade: split-expense receivables and refund chains hang off the
        // transaction, so they should disappear with it locally too.
        receivables: state.receivables.filter((r) => r.transaction_id !== id),
      };
    }

    // --- Accounts ---

    case ADD_ACCOUNT:
      return { ...state, accounts: [...state.accounts, action.payload] };

    case UPDATE_ACCOUNT: {
      const { id, data } = action.payload;
      return {
        ...state,
        accounts: state.accounts.map((a) => (a.id === id ? { ...a, ...data } : a)),
      };
    }

    case DELETE_ACCOUNT:
      return {
        ...state,
        accounts: state.accounts.filter((a) => a.id !== action.payload),
      };

    // --- Categories ---

    case ADD_CATEGORY:
      return { ...state, categories: [...state.categories, action.payload] };

    case UPDATE_CATEGORY: {
      const { id, data } = action.payload;
      return {
        ...state,
        categories: state.categories.map((c) => (c.id === id ? { ...c, ...data } : c)),
      };
    }

    case DELETE_CATEGORY: {
      // Backend sets children's parent to null on delete (SET_NULL FK). Mirror
      // that locally so the categories tree doesn't briefly show orphan
      // pointers before any refetch.
      const deletedId = action.payload;
      return {
        ...state,
        categories: state.categories
          .filter((c) => c.id !== deletedId)
          .map((c) => {
            const parentId = c.parent ?? c.parent_id;
            if (parentId === deletedId) {
              const next = { ...c };
              if ('parent' in next) next.parent = null;
              if ('parent_id' in next) next.parent_id = null;
              return next;
            }
            return c;
          }),
      };
    }

    // --- Receivables ---

    case ADD_RECEIVABLE:
      return { ...state, receivables: [...state.receivables, action.payload] };

    case UPDATE_RECEIVABLE: {
      const { id, data } = action.payload;
      return {
        ...state,
        receivables: state.receivables.map((r) => (r.id === id ? { ...r, ...data } : r)),
      };
    }

    // --- Account Types ---

    case SET_ACCOUNT_TYPES:
      return { ...state, accountTypes: action.payload };

    // --- Settings ---

    case SET_SETTINGS: {
      const { key, value } = action.payload;
      return {
        ...state,
        settings: { ...state.settings, [key]: value },
      };
    }

    default:
      return state;
  }
}

// API → frontend transforms. Amounts arrive as strings (Django DecimalField)
// and are converted to Decimal at this boundary so downstream arithmetic
// doesn't suffer float drift.

function transformEntry(e) {
  return {
    ...e,
    transaction_id: e.transaction,
    account_id: e.account,
    category_id: e.category,
    amount: D(e.amount),
  };
}

function transformTransaction(t) {
  return {
    ...t,
    category_id: t.category,
  };
}

function transformReceivable(r) {
  return {
    ...r,
    transaction_id: r.transaction,
    amount_owed: D(r.amount_owed),
    amount_settled: D(r.amount_settled),
  };
}

function transformBudget(b) {
  return {
    ...b,
    amount: D(b.amount),
  };
}

// Resolves type/sub_type FK ids to their string names ("asset",
// "credit_card") so display and accounting logic can switch on them. Keeps
// the original ids under type_id / sub_type_id for forms.
function transformAccount(a, typeNameMap, subTypeNameMap) {
  return {
    ...a,
    type_id: a.type,
    sub_type_id: a.sub_type,
    type: typeNameMap?.get(a.type) ?? a.type_name ?? a.type,
    sub_type: subTypeNameMap?.get(a.sub_type) ?? a.sub_type_name ?? a.sub_type,
  };
}

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [state, dispatch] = useReducer(dataReducer, initialState);

  const initialLoadDone = useRef(false);

  const loadData = useCallback(async () => {
    // Only block the UI on the very first load; refetches stay silent.
    if (!initialLoadDone.current) {
      dispatch({ type: SET_LOADING, payload: true });
    }
    try {
      const data = await api.getAllData();

      const accountTypes = data.account_types ?? [];
      const typeNameMap = new Map();
      const subTypeNameMap = new Map();
      for (const at of accountTypes) {
        typeNameMap.set(at.id, at.name);
        for (const st of (at.sub_types ?? [])) {
          subTypeNameMap.set(st.id, st.name);
        }
      }

      const atList = Array.isArray(accountTypes) ? accountTypes : (accountTypes.results ?? []);
      dispatch({ type: SET_ACCOUNT_TYPES, payload: atList });

      dispatch({
        type: SET_DATA,
        payload: {
          accounts: (data.accounts ?? []).map((a) => transformAccount(a, typeNameMap, subTypeNameMap)),
          categories: data.categories ?? [],
          transactions: (data.transactions ?? []).map(transformTransaction),
          entries: (data.entries ?? []).map(transformEntry),
          receivables: (data.receivables ?? []).map(transformReceivable),
          budgets: (data.budgets ?? []).map(transformBudget),
          settings: data.settings ?? {},
        },
      });
      initialLoadDone.current = true;
    } catch (err) {
      console.error('DataContext: loadData failed', err);
      dispatch({ type: SET_ERROR, payload: err.message ?? String(err) });
    }
  }, []);


  // Transaction mutations dispatch surgically against the local reducer
  // (TransactionDetailSerializer returns entries + receivables inline so we
  // never need a follow-up /api/data/all/ refetch).

  const addTransaction = useCallback(async (transactionData) => {
    const result = await api.createTransaction(transactionData);
    dispatch({
      type: ADD_TRANSACTION,
      payload: {
        transaction: transformTransaction(result),
        entries: (result.entries ?? []).map(transformEntry),
        receivables: (result.receivables ?? []).map(transformReceivable),
      },
    });
    return result;
  }, []);

  const updateTransaction = useCallback(async (id, transactionData) => {
    const result = await api.updateTransaction(id, transactionData);
    dispatch({
      type: UPDATE_TRANSACTION,
      payload: {
        id,
        transaction: transformTransaction(result),
        newEntries: (result.entries ?? []).map(transformEntry),
        // Always replace receivables — backend returns the canonical set
        // (empty list for non-split types).
        newReceivables: (result.receivables ?? []).map(transformReceivable),
      },
    });
    return result;
  }, []);

  const deleteTransaction = useCallback(async (id) => {
    await api.deleteTransaction(id);
    dispatch({ type: DELETE_TRANSACTION, payload: { id } });
  }, []);

  // Confirms an SMS server-side (creates a transaction, links the SMS to
  // it) and dispatches the new transaction surgically. SMSPage handles its
  // own list refresh via the onSuccess callback.
  const confirmSMS = useCallback(async (smsId, payload) => {
    const result = await api.confirmSMS(smsId, payload);
    dispatch({
      type: ADD_TRANSACTION,
      payload: {
        transaction: transformTransaction(result),
        entries: (result.entries ?? []).map(transformEntry),
        receivables: (result.receivables ?? []).map(transformReceivable),
      },
    });
    return result;
  }, []);

  const { typeNameMap, subTypeNameMap } = useMemo(() => {
    const tMap = new Map();
    const sMap = new Map();
    for (const at of state.accountTypes) {
      tMap.set(at.id, at.name);
      for (const st of (at.sub_types ?? [])) {
        sMap.set(st.id, st.name);
      }
    }
    return { typeNameMap: tMap, subTypeNameMap: sMap };
  }, [state.accountTypes]);

  const addAccount = useCallback(async (accountData) => {
    const result = await api.createAccount(accountData);
    dispatch({ type: ADD_ACCOUNT, payload: transformAccount(result, typeNameMap, subTypeNameMap) });
    return result;
  }, [typeNameMap, subTypeNameMap]);

  const updateAccount = useCallback(async (id, data) => {
    const result = await api.updateAccount(id, data);
    dispatch({ type: UPDATE_ACCOUNT, payload: { id, data: transformAccount(result, typeNameMap, subTypeNameMap) } });
    return result;
  }, [typeNameMap, subTypeNameMap]);

  const deleteAccount = useCallback(async (id) => {
    await api.deleteAccount(id);
    dispatch({ type: DELETE_ACCOUNT, payload: id });
  }, []);

  const addCategory = useCallback(async (categoryData) => {
    const result = await api.createCategory(categoryData);
    dispatch({ type: ADD_CATEGORY, payload: result });
    return result;
  }, []);

  const updateCategory = useCallback(async (id, data) => {
    const result = await api.updateCategory(id, data);
    dispatch({ type: UPDATE_CATEGORY, payload: { id, data: result } });
    return result;
  }, []);

  const deleteCategory = useCallback(async (id) => {
    await api.deleteCategory(id);
    // Reducer re-parents children to null to mirror the server's SET_NULL
    // cascade. Backend ProtectedError blocks the delete if transactions
    // reference this category.
    dispatch({ type: DELETE_CATEGORY, payload: id });
  }, []);

  const updateReceivable = useCallback(async (id, data) => {
    const result = await api.updateReceivable(id, data);
    dispatch({ type: UPDATE_RECEIVABLE, payload: { id, data: transformReceivable(result) } });
    return result;
  }, []);

  const loadAccountTypes = useCallback(async () => {
    try {
      const data = await api.getAccountTypes();
      // Endpoint may be paginated or a plain array depending on DRF settings.
      const list = Array.isArray(data) ? data : (data.results ?? []);
      dispatch({ type: SET_ACCOUNT_TYPES, payload: list });
    } catch (err) {
      console.error('DataContext: loadAccountTypes failed', err);
    }
  }, []);

  const addAccountType = useCallback(async (data) => {
    await api.createAccountType(data);
    await loadAccountTypes();
  }, [loadAccountTypes]);

  const updateAccountType = useCallback(async (id, data) => {
    await api.updateAccountType(id, data);
    await loadAccountTypes();
  }, [loadAccountTypes]);

  const deleteAccountType = useCallback(async (id) => {
    await api.deleteAccountType(id);
    await loadAccountTypes();
  }, [loadAccountTypes]);

  const addAccountSubType = useCallback(async (data) => {
    await api.createAccountSubType(data);
    await loadAccountTypes();
  }, [loadAccountTypes]);

  const updateAccountSubType = useCallback(async (id, data) => {
    await api.updateAccountSubType(id, data);
    await loadAccountTypes();
  }, [loadAccountTypes]);

  const deleteAccountSubType = useCallback(async (id) => {
    await api.deleteAccountSubType(id);
    await loadAccountTypes();
  }, [loadAccountTypes]);

  // Auto-load data on mount
  useEffect(() => {
    loadData();
    loadAccountTypes();
  }, [loadData, loadAccountTypes]);

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------

  const updateSettings = useCallback(async (key, value) => {
    dispatch({ type: SET_SETTINGS, payload: { key, value } });
    try {
      await api.updateSetting(key, value);
    } catch (err) {
      console.error('DataContext: updateSettings failed', err);
      await loadData();
    }
  }, [loadData]);

  const value = useMemo(() => ({
    ...state,
    loadData,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addAccount,
    updateAccount,
    deleteAccount,
    addCategory,
    updateCategory,
    deleteCategory,
    confirmSMS,
    updateReceivable,
    addAccountType,
    updateAccountType,
    deleteAccountType,
    addAccountSubType,
    updateAccountSubType,
    deleteAccountSubType,
    updateSettings,
  }), [
    state, loadData,
    addTransaction, updateTransaction, deleteTransaction,
    addAccount, updateAccount, deleteAccount,
    addCategory, updateCategory, deleteCategory,
    confirmSMS,
    updateReceivable,
    addAccountType, updateAccountType, deleteAccountType,
    addAccountSubType, updateAccountSubType, deleteAccountSubType,
    updateSettings,
  ]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (ctx === null) {
    throw new Error('useData must be used inside a <DataProvider>');
  }
  return ctx;
}
