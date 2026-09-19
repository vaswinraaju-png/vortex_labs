// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const PAGE_URL = `file://${path.resolve(__dirname, '..', 'index.html')}`;

test.describe('Lead modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE_URL);
  });

  test('modal is hidden on page load', async ({ page }) => {
    const modal = page.locator('#leadModal');
    await expect(modal).not.toHaveClass(/open/);
  });

  test('clicking a CTA button opens the modal', async ({ page }) => {
    const modal = page.locator('#leadModal');
    await page.locator('.open-modal').first().click();
    await expect(modal).toHaveClass(/open/);
  });

  test('opening modal disables body scroll', async ({ page }) => {
    await page.locator('.open-modal').first().click();
    const overflow = await page.evaluate(() => document.body.style.overflow);
    expect(overflow).toBe('hidden');
  });

  test('clicking the close button hides the modal', async ({ page }) => {
    const modal = page.locator('#leadModal');
    await page.locator('.open-modal').first().click();
    await page.locator('#modalClose').click();
    await expect(modal).not.toHaveClass(/open/);
  });

  test('closing modal restores body scroll', async ({ page }) => {
    await page.locator('.open-modal').first().click();
    await page.locator('#modalClose').click();
    const overflow = await page.evaluate(() => document.body.style.overflow);
    expect(overflow).toBe('');
  });

  test('pressing Escape closes the modal', async ({ page }) => {
    const modal = page.locator('#leadModal');
    await page.locator('.open-modal').first().click();
    await page.keyboard.press('Escape');
    await expect(modal).not.toHaveClass(/open/);
  });

  test('clicking the backdrop (outside modal content) closes it', async ({ page }) => {
    const modal = page.locator('#leadModal');
    await page.locator('.open-modal').first().click();
    await expect(modal).toHaveClass(/open/);
    // Click on the modal overlay itself, not the inner card
    await modal.click({ position: { x: 5, y: 5 } });
    await expect(modal).not.toHaveClass(/open/);
  });

  test('opening modal closes any open mobile menu', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#hamburger').click();
    await expect(page.locator('#mobileMenu')).toHaveClass(/open/);

    await page.locator('.open-modal').first().click();
    await expect(page.locator('#mobileMenu')).not.toHaveClass(/open/);
    await expect(page.locator('#hamburger')).not.toHaveClass(/open/);
  });

  test('modal form is visible and success message is hidden on open', async ({ page }) => {
    await page.locator('.open-modal').first().click();
    await expect(page.locator('#modalForm')).not.toHaveClass(/hide/);
    await expect(page.locator('#modalSuccess')).not.toHaveClass(/show/);
  });
});
