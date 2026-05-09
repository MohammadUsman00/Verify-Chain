const { test, expect } = require('@playwright/test');

test('landing to login to seller demo flow', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1.hero-title')).toContainText('Every Product');

  await page.getByRole('link', { name: 'Start Free →' }).first().click();
  await expect(page).toHaveURL(/#\/login$/);
  await expect(page.getByText('Seller Sign In')).toBeVisible();

  await page.getByRole('link', { name: 'Skip login (use demo data)' }).click();
  await expect(page).toHaveURL(/#\/seller$/);
  await expect(page.getByText('SELLER OPERATIONS')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Wani Premium Exports' })).toBeVisible();
});

test('scan view renders camera/manual controls', async ({ page }) => {
  await page.goto('/#/scan');
  await expect(page.getByRole('heading', { name: 'Verify Product' })).toBeVisible();
  await expect(page.locator('#btn-camera')).toBeVisible();
  await expect(page.locator('#btn-manual')).toBeVisible();
  await expect(page.locator('#scan-video')).toBeVisible();
});
