import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import api from '../api/client';
import { D } from '../utils/money';
import { readCachedData, writeCachedData } from '../utils/dataCache';

const initialState = {
  accounts: [],
  categories: [],
  // transactions/entries are no longer held in memory — they're server-paginated
  // and aggregated. budgets are lazy-loaded where needed.
  receivables: [],
  accountTypes: [],
  settings: {},
  isLoading: true,
  error: null,
  // Bumped after every transaction mutation so server-backed hooks (list,
  // balances, reports, summary) refetch.
  dataVersion: 0,
};

const SET_DATA            = 'SET_DATA';
const SET_LOADING         = 'SET_LOADING';
const SET_ERROR           = 'SET_ERROR';
const BUMP_VERSION        = 'BUMP_VERSION';
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

    case BUMP_VERSION:
      return { ...state, dataVersion: state.dataVersion + 1 };

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

function transformReceivable(r) {
  return {
    ...r,
    transaction_id: r.transaction,
    amount_owed: D(r.amount_owed),
    amount_settled: D(r.amount_settled),
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

  // Turns a RAW /api/data/all/ payload (strings, no Decimals) into reducer
  // state. Shared by the network path and the IndexedDB rehydrate path so both
  // go through the exact same transforms.
  const applyRawData = useCallback((data) => {
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
    // Only set when present so we don't clobber the dedicated loadAccountTypes()
    // fetch when the bootstrap payload omits account_types.
    if (atList.length > 0) {
      dispatch({ type: SET_ACCOUNT_TYPES, payload: atList });
    }

    dispatch({
      type: SET_DATA,
      payload: {
        accounts: (data.accounts ?? []).map((a) => transformAccount(a, typeNameMap, subTypeNameMap)),
        categories: data.categories ?? [],
        receivables: (data.receivables ?? []).map(transformReceivable),
        settings: data.settings ?? {},
      },
    });
  }, []);

  const loadData = useCallback(async () => {
    // Only block the UI on the very first load; refetches stay silent.
    if (!initialLoadDone.current) {
      dispatch({ type: SET_LOADING, payload: true });
    }
    try {
      const data = await api.getBootstrapData();
      applyRawData(data);        // transforms (strings -> Decimal) happen here
      writeCachedData(data);     // cache the (now small) payload for instant rehydrate
      initialLoadDone.current = true;
    } catch (err) {
      console.error('DataContext: loadData failed', err);
      dispatch({ type: SET_ERROR, payload: err.message ?? String(err) });
    }
  }, [applyRawData]);


  // After any transaction mutation, bump dataVersion (so the server-backed
  // list/balances/reports/summary refetch) and reload the bootstrap data (so
  // the in-context receivables reflect split/reimbursement changes).
  const invalidate = useCallback(() => {
    dispatch({ type: BUMP_VERSION });
    loadData();
  }, [loadData]);

  const addTransaction = useCallback(async (transactionData) => {
    const result = await api.createTransaction(transactionData);
    invalidate();
    return result;
  }, [invalidate]);

  const updateTransaction = useCallback(async (id, transactionData) => {
    const result = await api.updateTransaction(id, transactionData);
    invalidate();
    return result;
  }, [invalidate]);

  const deleteTransaction = useCallback(async (id) => {
    await api.deleteTransaction(id);
    invalidate();
  }, [invalidate]);

  // Confirms an SMS server-side (creates a transaction, links the SMS to it).
  // SMSPage handles its own list refresh via the onSuccess callback.
  const confirmSMS = useCallback(async (smsId, payload) => {
    const result = await api.confirmSMS(smsId, payload);
    invalidate();
    return result;
  }, [invalidate]);

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

  // Mount: rehydrate from the IndexedDB cache first so a discarded-tab reload
  // paints the last-seen data immediately (no spinner, no blocking network),
  // then revalidate over the network in the background. Stale-while-revalidate.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await readCachedData();
      if (!cancelled && cached && !initialLoadDone.current) {
        applyRawData(cached);            // isLoading -> false immediately
        initialLoadDone.current = true;  // makes the background loadData() silent
      }
      if (!cancelled) {
        loadData();          // background revalidate of the bulk payload
        loadAccountTypes();  // standalone account-types endpoint (its own shape)
      }
    })();
    return () => { cancelled = true; };
  }, [loadData, loadAccountTypes, applyRawData]);

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
