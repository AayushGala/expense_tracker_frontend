import { test, expect } from '@playwright/test';
import { resetState, postSMS } from '../helpers/api.js';

test.beforeEach(async () => {
  await resetState();
});

test('two SMS segments within 30s merge into one row', async ({ page }) => {
  const stamp = Date.now();
  const sender = `AD-STITCH-${stamp}`;
  // Carrier-split simulation. Use a fixed received_at so the second falls
  // inside the 30-second window.
  const base = '2026-05-17T12:52:47+05:30';
  const later = '2026-05-17T12:52:50+05:30';

  const first = await postSMS({
    sender,
    body: `HSBC: Your A/c is credited with INR 120000 [${stamp}] Yo`,
    receivedAt: base,
  });
  const second = await postSMS({
    sender,
    body: 'ur Avl Bal is INR 9999.99 .',
    receivedAt: later,
  });

  // Both responses should reference the same id.
  expect(second.id).toBe(first.id);

  await page.goto(`/sms?search=${encodeURIComponent(`[${stamp}]`)}`);
  // Exactly one row in the table (or one card) carries this marker.
  await expect(page.getByText(`[${stamp}]`).first()).toBeVisible({ timeout: 10_000 });
  const matches = await page.getByText(`[${stamp}]`).count();
  // Once per render variant (desktop row + mobile card), capped by viewport.
  expect(matches).toBeLessThanOrEqual(2);
});
