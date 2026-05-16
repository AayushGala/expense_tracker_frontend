import { D, ZERO, round2 } from './money';

export const ENTRY_TYPE = {
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
};

// Returns { valid, totalDebits, totalCredits, difference } — all Decimals
// except `valid`. Debits and credits must match for a balanced txn.
export function validateEntries(entries) {
  let totalDebits = ZERO;
  let totalCredits = ZERO;

  for (const entry of entries) {
    const a = D(entry.amount);
    if (entry.entry_type === ENTRY_TYPE.DEBIT) {
      totalDebits = totalDebits.plus(a);
    } else if (entry.entry_type === ENTRY_TYPE.CREDIT) {
      totalCredits = totalCredits.plus(a);
    }
  }

  totalDebits = round2(totalDebits);
  totalCredits = round2(totalCredits);
  const difference = round2(totalDebits.minus(totalCredits));

  return {
    valid: difference.isZero(),
    totalDebits,
    totalCredits,
    difference,
  };
}

// Sign convention is applied by computeAccountBalances based on account type;
// this helper just returns the raw debit/credit totals.
export function computeRawBalance(entries, accountId) {
  let debits = ZERO;
  let credits = ZERO;

  for (const entry of entries) {
    if (entry.account_id !== accountId) continue;
    const a = D(entry.amount);
    if (entry.entry_type === ENTRY_TYPE.DEBIT) {
      debits = debits.plus(a);
    } else if (entry.entry_type === ENTRY_TYPE.CREDIT) {
      credits = credits.plus(a);
    }
  }

  return { debits: round2(debits), credits: round2(credits) };
}

// Assets / Receivables / Expenses are debit-normal (debits − credits).
// Liabilities / Income / Equity are credit-normal (credits − debits).
function applySignConvention(totals, accountType) {
  const { debits, credits } = totals;
  switch (accountType) {
    case 'asset':
    case 'receivable':
    case 'expense':
      return round2(debits.minus(credits));
    case 'liability':
    case 'income':
    case 'equity':
      return round2(credits.minus(debits));
    default:
      return round2(debits.minus(credits));
  }
}

export function computeAccountBalances(entries, accounts) {
  const accountTypeLookup = new Map();
  for (const account of accounts) {
    accountTypeLookup.set(account.id, account.type);
  }

  const accountIds = new Set(
    entries.map((e) => e.account_id).filter((id) => id != null),
  );

  const balances = new Map();
  for (const accountId of accountIds) {
    const totals = computeRawBalance(entries, accountId);
    const accountType = accountTypeLookup.get(accountId) ?? 'asset';
    balances.set(accountId, applySignConvention(totals, accountType));
  }

  return balances;
}

export function computeCategoryBalances(entries, categories) {
  const categoryTypeLookup = new Map();
  for (const category of categories) {
    categoryTypeLookup.set(category.id, category.type);
  }

  const categoryIds = new Set(
    entries.map((e) => e.category_id).filter((id) => id != null),
  );

  const balances = new Map();
  for (const categoryId of categoryIds) {
    let debits = ZERO;
    let credits = ZERO;
    for (const entry of entries) {
      if (entry.category_id !== categoryId) continue;
      const a = D(entry.amount);
      if (entry.entry_type === ENTRY_TYPE.DEBIT) debits = debits.plus(a);
      else if (entry.entry_type === ENTRY_TYPE.CREDIT) credits = credits.plus(a);
    }
    const totals = { debits: round2(debits), credits: round2(credits) };
    const categoryType = categoryTypeLookup.get(categoryId) ?? 'expense';
    balances.set(categoryId, applySignConvention(totals, categoryType));
  }

  return balances;
}

// Assets + Receivables − Liabilities. Equity / income / expense accounts
// don't contribute.
export function computeNetWorth(balances, accounts) {
  let netWorth = ZERO;

  for (const account of accounts) {
    const balance = D(balances.get(account.id) ?? 0);
    switch (account.type) {
      case 'asset':
      case 'receivable':
        netWorth = netWorth.plus(balance);
        break;
      case 'liability':
        netWorth = netWorth.minus(balance);
        break;
      default:
        break;
    }
  }

  return round2(netWorth);
}
