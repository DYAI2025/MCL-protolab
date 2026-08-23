import { expect, test } from '@playwright/test';

// Placeholder harness check only: proves webServer boots Vite, the page loads
// and a screenshot can be written. The real engine smoke test lands with the
// PlayCanvas boot task — do not assert engine, WebGL or physics behaviour here.
test('the page shell loads and the canvas element is present', async ({ page }, testInfo) => {
  await page.goto('/');

  await expect(page).toHaveTitle('MCL Protolab');
  await expect(page.locator('#application-canvas')).toHaveCount(1);

  await page.screenshot({ path: testInfo.outputPath('shell.png') });
});
