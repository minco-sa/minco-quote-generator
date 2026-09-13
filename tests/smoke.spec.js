// @ts-check
const { test, expect } = require('@playwright/test');

test('quote generator page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/MINCO Quote Generator/);
});
