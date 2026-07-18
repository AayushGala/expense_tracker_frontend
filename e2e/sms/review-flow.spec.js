import { test, expect } from '@playwright/test';
import {
  resetState,
  postSMS,
  patchSMS,
  getAccounts,
  getCategories,
  createExpense,
  listTransactions,
} from '../helpers/api.js';

const today = () => new Date().toISOString().slice(0, 10);

// A parsed-but-unconfirmed SMS, ready for the review card.
async function seedParsedSMS({ amount, accountId, categoryId, body, sender = 'AD-HDFCBK' }) {
  const sms = await postSMS({
    sender,
    body,
    receivedAt: new Date().toISOString(),
  });
  await patchSMS(sms.id, {
    status: 'parsed',
    parsed_amount: String(amount),
    parsed_direction: 'debit',
    parsed_type: 'expense',
    parsed_account: accountId,
    parsed_category: categoryId,
    parsed_date: today(),
  });
  return sms;
}

let hdfc, otherAccount, groceries;

test.beforeEach(async () => {
  await resetState();
  const accounts = (await getAccounts()).filter((a) => !/receivable/i.test(a.type_name ?? ''));
  [hdfc, otherAccount] = accounts;
  groceries = (await getCategories()).find((c) => c.type === 'expense');
});

test('confirming a parsed SMS from the review card creates the transaction', async ({ page }) => {
  const body = `e2e review ${Date.now()}: Rs 512 debited`;
  await seedParsedSMS({ amount: 512, accountId: hdfc.id, categoryId: groceries.id, body });

  await page.goto('/sms/review?since=all');
  await expect(page.getByText(body)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('1 of 1')).toBeVisible();

  await page.getByRole('button', { name: 'Confirm transaction' }).click();
  await expect(page.getByText(/Linked to transaction #\d+/).first()).toBeVisible();

  const txns = await listTransactions();
  expect(txns).toHaveLength(1);
  expect(txns[0].amount).toBe('512.00');
});

test('possible-duplicate banner links the SMS instead of creating a twin', async ({ page }) => {
  // The purchase already exists (confirmed from the other bank's SMS).
  await createExpense({
    amount: 649, accountId: hdfc.id, categoryId: groceries.id,
    date: today(), notes: 'original purchase',
  });
  const body = `e2e dupe ${Date.now()}: Rs 649 spent on card`;
  await seedParsedSMS({ amount: 649, accountId: otherAccount.id, categoryId: groceries.id, body });

  await page.goto('/sms/review?since=all');
  await expect(page.getByText('Possible duplicate')).toBeVisible({ timeout: 10_000 });
  // Confirm is withheld while the banner is undecided.
  await expect(page.getByRole('button', { name: 'Confirm transaction' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Link to this' }).click();
  await expect(page.getByText(/Linked to transaction #\d+/).first()).toBeVisible();

  // Linked, not duplicated.
  const txns = await listTransactions();
  expect(txns).toHaveLength(1);
});

test('ignore advances to the next card', async ({ page }) => {
  const first = `e2e ignore-me ${Date.now()}`;
  const second = `e2e keep-me ${Date.now()}`;
  // Distinct senders — same-sender messages seconds apart would be
  // stitched into one row by design.
  await seedParsedSMS({ amount: 100, accountId: hdfc.id, categoryId: groceries.id, body: first, sender: 'AD-HDFCBK' });
  await seedParsedSMS({ amount: 200, accountId: hdfc.id, categoryId: groceries.id, body: second, sender: 'VM-ICICIB' });

  await page.goto('/sms/review?since=all');
  await expect(page.getByText('1 of 2')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(first)).toBeVisible();

  await page.getByRole('button', { name: 'Ignore' }).click();
  await expect(page.getByText(second)).toBeVisible();
  await expect(page.getByText('1 of 1')).toBeVisible();
});
