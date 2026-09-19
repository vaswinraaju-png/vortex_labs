// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const PAGE_URL = `file://${path.resolve(__dirname, '..', 'index.html')}`;
const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScQTywgo0TiLyYXCgdbdkKYJhdCaUTgwvoCfV6tBr_fG8i4Gg/formResponse';

const VALID_FORM_DATA = {
  name: 'Jane Smith',
  mobile: '+91 9876543210',
  email: 'jane@example.com',
  brand: 'TestBrand',
  spend: '₹1L – ₹5L / month',
  goal: 'Scale Revenue',
};

/** Opens the modal and returns the page object (for chaining). */
async function openModal(page) {
  await page.goto(PAGE_URL);
  await page.locator('.open-modal').first().click();
}

/** Fills all form fields with the given data. */
async function fillForm(page, data = VALID_FORM_DATA) {
  await page.locator('#f-name').fill(data.name);
  await page.locator('#f-mobile').fill(data.mobile);
  await page.locator('#f-email').fill(data.email);
  await page.locator('#f-brand').fill(data.brand);
  if (data.spend) await page.locator('#f-spend').selectOption({ label: data.spend });
  if (data.goal) await page.locator('#f-goal').selectOption({ label: data.goal });
}

test.describe('Form validation', () => {
  test.beforeEach(async ({ page }) => {
    await openModal(page);
  });

  test('submit with all fields empty shows validation warning', async ({ page }) => {
    await page.locator('#modalSubmit').click();
    await expect(page.locator('#modalSubmit')).toContainText('Please fill all required fields');
  });

  test('submit with only name filled shows validation warning', async ({ page }) => {
    await page.locator('#f-name').fill('Jane');
    await page.locator('#modalSubmit').click();
    await expect(page.locator('#modalSubmit')).toContainText('Please fill all required fields');
  });

  test('validation warning resets button text after ~2.2s', async ({ page }) => {
    await page.locator('#modalSubmit').click();
    await expect(page.locator('#modalSubmit')).toContainText('Please fill all required fields');
    await page.waitForTimeout(2400);
    await expect(page.locator('#modalSubmit')).toContainText('Send My Audit Request');
  });

  test('validation failure does not show success message', async ({ page }) => {
    await page.locator('#modalSubmit').click();
    await expect(page.locator('#modalSuccess')).not.toHaveClass(/show/);
    await expect(page.locator('#modalForm')).not.toHaveClass(/hide/);
  });
});

test.describe('Form submission', () => {
  test('successful submission shows success message and hides form', async ({ page }) => {
    // Intercept the Google Forms request so tests don't depend on the network
    await page.route(`${GOOGLE_FORM_URL}**`, route => route.fulfill({ status: 200, body: '' }));

    await openModal(page);
    await fillForm(page);
    await page.locator('#modalSubmit').click();

    await expect(page.locator('#modalSuccess')).toHaveClass(/show/);
    await expect(page.locator('#modalForm')).toHaveClass(/hide/);
  });

  test('submit button is disabled while sending', async ({ page }) => {
    // Delay the response so we can observe the loading state
    await page.route(`${GOOGLE_FORM_URL}**`, async route => {
      await new Promise(r => setTimeout(r, 300));
      route.fulfill({ status: 200, body: '' });
    });

    await openModal(page);
    await fillForm(page);
    await page.locator('#modalSubmit').click();

    // Button should be disabled immediately after click
    await expect(page.locator('#modalSubmit')).toBeDisabled();
    // Then re-enabled after submission completes
    await expect(page.locator('#modalSuccess')).toHaveClass(/show/);
    await expect(page.locator('#modalSubmit')).toBeEnabled();
  });

  test('sends request to correct Google Forms URL', async ({ page }) => {
    let capturedURL = '';
    await page.route(`${GOOGLE_FORM_URL}**`, route => {
      capturedURL = route.request().url();
      route.fulfill({ status: 200, body: '' });
    });

    await openModal(page);
    await fillForm(page);
    await page.locator('#modalSubmit').click();
    await expect(page.locator('#modalSuccess')).toHaveClass(/show/);

    expect(capturedURL).toContain('docs.google.com/forms/d/e/1FAIpQLScQTywgo0TiLyYXCgdbdkKYJhdCaUTgwvoCfV6tBr_fG8i4Gg/formResponse');
  });

  test('sends correct Google Forms entry IDs in request body', async ({ page }) => {
    let requestBody = '';
    await page.route(`${GOOGLE_FORM_URL}**`, async route => {
      requestBody = route.request().postData() || '';
      route.fulfill({ status: 200, body: '' });
    });

    await openModal(page);
    await fillForm(page);
    await page.locator('#modalSubmit').click();
    await expect(page.locator('#modalSuccess')).toHaveClass(/show/);

    // Verify all 6 entry IDs are present — changing these would silently break lead capture
    expect(requestBody).toContain('entry.659319553'); // name
    expect(requestBody).toContain('entry.84612590');  // mobile
    expect(requestBody).toContain('entry.575777860'); // email
    expect(requestBody).toContain('entry.1998357470'); // brand
    expect(requestBody).toContain('entry.630119346'); // spend
    expect(requestBody).toContain('entry.544290577'); // goal
  });

  test('form field values are sent correctly', async ({ page }) => {
    let requestBody = '';
    await page.route(`${GOOGLE_FORM_URL}**`, async route => {
      requestBody = route.request().postData() || '';
      route.fulfill({ status: 200, body: '' });
    });

    await openModal(page);
    await fillForm(page);
    await page.locator('#modalSubmit').click();
    await expect(page.locator('#modalSuccess')).toHaveClass(/show/);

    expect(requestBody).toContain(encodeURIComponent(VALID_FORM_DATA.name));
    expect(requestBody).toContain(encodeURIComponent(VALID_FORM_DATA.email));
    expect(requestBody).toContain(encodeURIComponent(VALID_FORM_DATA.brand));
  });

  test('network error still shows success (no-cors design)', async ({ page }) => {
    // Simulate a fetch failure — by design the form should still show success
    await page.route(`${GOOGLE_FORM_URL}**`, route => route.abort('failed'));

    await openModal(page);
    await fillForm(page);
    await page.locator('#modalSubmit').click();

    await expect(page.locator('#modalSuccess')).toHaveClass(/show/);
    await expect(page.locator('#modalForm')).toHaveClass(/hide/);
  });
});
