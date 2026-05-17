import { test, expect } from '@playwright/test';
import { resetState, postSMS } from '../helpers/api.js';

test.beforeEach(async () => {
  await resetState();
});

test('an SMS posted from the forwarder appears in the SMS list', async ({ page }) => {
  const body = `e2e SMS ${Date.now()}: Rs 500 debited from XX1234 -HDFC`;
  await postSMS({
    sender: 'AD-HDFCBK',
    body,
    receivedAt: new Date().toISOString(),
  });

  await page.goto('/sms');
  // Body previews render twice (table + mobile card); pick the table row.
  await expect(
    page.getByRole('table').getByText(body.slice(0, 50)),
  ).toBeVisible({ timeout: 10_000 });
});
