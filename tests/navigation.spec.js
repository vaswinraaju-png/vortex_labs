// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const PAGE_URL = `file://${path.resolve(__dirname, '..', 'index.html')}`;

test.describe('Mobile hamburger menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE_URL);
    // Force mobile viewport so hamburger is visible
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test('hamburger button is visible on mobile', async ({ page }) => {
    const hamburger = page.locator('#hamburger');
    await expect(hamburger).toBeVisible();
  });

  test('clicking hamburger opens the mobile menu', async ({ page }) => {
    const hamburger = page.locator('#hamburger');
    const mobileMenu = page.locator('#mobileMenu');

    await expect(mobileMenu).not.toHaveClass(/open/);
    await hamburger.click();
    await expect(mobileMenu).toHaveClass(/open/);
    await expect(hamburger).toHaveClass(/open/);
  });

  test('opening menu disables body scroll', async ({ page }) => {
    await page.locator('#hamburger').click();
    const overflow = await page.evaluate(() => document.body.style.overflow);
    expect(overflow).toBe('hidden');
  });

  test('clicking hamburger again closes the menu', async ({ page }) => {
    const hamburger = page.locator('#hamburger');
    const mobileMenu = page.locator('#mobileMenu');

    await hamburger.click(); // open
    await hamburger.click(); // close
    await expect(mobileMenu).not.toHaveClass(/open/);
    await expect(hamburger).not.toHaveClass(/open/);
  });

  test('closing menu restores body scroll', async ({ page }) => {
    const hamburger = page.locator('#hamburger');
    await hamburger.click(); // open
    await hamburger.click(); // close
    const overflow = await page.evaluate(() => document.body.style.overflow);
    expect(overflow).toBe('');
  });

  test('clicking a mobile nav link closes the menu', async ({ page }) => {
    const hamburger = page.locator('#hamburger');
    const mobileMenu = page.locator('#mobileMenu');

    await hamburger.click();
    await expect(mobileMenu).toHaveClass(/open/);

    const firstMobLink = page.locator('.mob-link').first();
    await firstMobLink.click();

    await expect(mobileMenu).not.toHaveClass(/open/);
    await expect(hamburger).not.toHaveClass(/open/);
  });

  test('clicking a mobile nav link restores body scroll', async ({ page }) => {
    await page.locator('#hamburger').click();
    await page.locator('.mob-link').first().click();
    const overflow = await page.evaluate(() => document.body.style.overflow);
    expect(overflow).toBe('');
  });
});
