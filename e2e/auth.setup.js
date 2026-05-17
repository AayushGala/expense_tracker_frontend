import { test as setup, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const AUTH_FILE = 'e2e/.auth/user.json';
const USERNAME = process.env.E2E_USERNAME || 'e2e_user';
const PASSWORD = process.env.E2E_PASSWORD || 'e2e_password_123';

setup('authenticate', async ({ page }) => {
  mkdirSync(dirname(AUTH_FILE), { recursive: true });

  await page.goto('/login');
  await page.getByPlaceholder('Enter username').fill(USERNAME);
  await page.getByPlaceholder('Enter password').fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for the post-login redirect. The dashboard renders the bottom-nav
  // "Transactions" link, which is a reliable signal we landed past /login.
  await expect(page.getByRole('link', { name: /transactions/i })).toBeVisible();

  await page.context().storageState({ path: AUTH_FILE });
});
