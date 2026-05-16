export const TRANSACTION_TYPES = [
  'expense',
  'income',
  'transfer',
  'bill_payment',
  'investment',
  'split_expense',
  'reimbursement',
];

// SET_TYPE preserves these unconditionally so type-switching mid-edit
// doesn't wipe what the user has already typed.
const SHARED_FIELDS = [
  'amount',
  'date',
  'owner',
  'platform',
  'notes',
  'tags',
  'beneficiary',
  'beneficiary_type',
  'custom_beneficiary',
];

// Account-direction fields are carried via carryAccount() with semantic
// promotion; other fields are only kept when they appear in BOTH the old
// and new type's set.
const TYPE_FIELDS = {
  expense:       ['from_account_id', 'category_id'],
  income:        ['to_account_id',   'category_id', 'source_transaction_id'],
  transfer:      ['from_account_id', 'to_account_id', 'fee', 'fee_category_id'],
  bill_payment:  ['from_account_id', 'to_account_id'],
  investment:    ['from_account_id', 'to_account_id'],
  split_expense: ['from_account_id', 'category_id', 'total_people', 'my_share_type', 'custom_my_share', 'other_people'],
  reimbursement: ['to_account_id',   'selected_receivable_id'],
};

export const FIELD_DEFAULTS = {
  amount: '',
  date: '',
  owner: '',
  platform: '',
  notes: '',
  tags: '',
  beneficiary: '',
  beneficiary_type: 'self',
  custom_beneficiary: '',
  from_account_id: '',
  to_account_id: '',
  category_id: '',
  source_transaction_id: null,
  fee: '',
  fee_category_id: '',
  total_people: '2',
  my_share_type: 'equal',
  custom_my_share: '',
  other_people: [],
  selected_receivable_id: '',
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Single-account types (expense has only from, income has only to) promote
// their value into the new type's available slot. Dual-account types keep
// both. Anything that doesn't fit is dropped.
function carryAccount(oldValues, oldType, newType) {
  const oldFields = TYPE_FIELDS[oldType] ?? [];
  const newFields = TYPE_FIELDS[newType] ?? [];
  const oldHasFrom = oldFields.includes('from_account_id');
  const oldHasTo = oldFields.includes('to_account_id');
  const newHasFrom = newFields.includes('from_account_id');
  const newHasTo = newFields.includes('to_account_id');

  const result = { from_account_id: '', to_account_id: '' };
  const oldFrom = oldValues.from_account_id ?? '';
  const oldTo = oldValues.to_account_id ?? '';

  if (oldHasFrom && oldHasTo) {
    if (newHasFrom) result.from_account_id = oldFrom;
    if (newHasTo) result.to_account_id = oldTo;
  } else if (oldHasFrom && !oldHasTo) {
    if (newHasFrom) result.from_account_id = oldFrom;
    else if (newHasTo) result.to_account_id = oldFrom;
  } else if (oldHasTo && !oldHasFrom) {
    if (newHasTo) result.to_account_id = oldTo;
    else if (newHasFrom) result.from_account_id = oldTo;
  }
  return result;
}

function pickKeys(obj, keys) {
  const out = {};
  for (const k of keys) {
    if (obj && k in obj) out[k] = obj[k];
  }
  return out;
}

export function valuesAfterTypeChange(currentValues, oldType, newType) {
  const next = { ...FIELD_DEFAULTS };
  Object.assign(next, pickKeys(currentValues, SHARED_FIELDS));
  Object.assign(next, carryAccount(currentValues, oldType, newType));

  const oldFields = TYPE_FIELDS[oldType] ?? [];
  const newFields = TYPE_FIELDS[newType] ?? [];
  const accountFields = new Set(['from_account_id', 'to_account_id']);
  const overlap = oldFields.filter(
    (f) => newFields.includes(f) && !accountFields.has(f),
  );
  Object.assign(next, pickKeys(currentValues, overlap));

  return next;
}

export function makeInitialState({ type = 'expense', date, initialValues } = {}) {
  return {
    type,
    submitting: false,
    values: {
      ...FIELD_DEFAULTS,
      date: date ?? todayIso(),
      ...(initialValues ?? {}),
    },
    errors: {},
  };
}

export function transactionFormReducer(state, action) {
  switch (action.type) {
    case 'SET_FIELD': {
      const { name, value } = action;
      const nextErrors = { ...state.errors };
      if (name in nextErrors) delete nextErrors[name];
      return {
        ...state,
        values: { ...state.values, [name]: value },
        errors: nextErrors,
      };
    }

    case 'SET_TYPE': {
      const newType = action.value;
      if (newType === state.type) return state;
      return {
        ...state,
        type: newType,
        values: valuesAfterTypeChange(state.values, state.type, newType),
        errors: {},
      };
    }

    case 'LOAD_INITIAL': {
      // Merge onto defaults so any field the source omits is explicitly
      // reset rather than left over from a previous state.
      const newType = action.payload?.type ?? state.type;
      const newValues = action.payload?.values ?? {};
      return {
        ...state,
        type: newType,
        values: { ...FIELD_DEFAULTS, date: todayIso(), ...newValues },
        errors: {},
      };
    }

    case 'SET_ERRORS':
      return { ...state, errors: action.errors ?? {} };

    case 'CLEAR_ERRORS':
      return { ...state, errors: {} };

    case 'SUBMITTING':
      return { ...state, submitting: Boolean(action.value) };

    default:
      return state;
  }
}
