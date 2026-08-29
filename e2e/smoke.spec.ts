import { expect, test } from '@playwright/test';

type ProtolabHook = {
  cratePosition: () => { x: number; y: number; z: number };
  physicsAlive: () => number;
};

test('runtime boots and physics simulates', async ({ page }, testInfo) => {
  const errors: string[] = [];
  // Attach BEFORE goto, or early boot errors are missed.
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => { errors.push(`pageerror: ${err.message}`); });

  await page.goto('/');
  await page.waitForFunction(() => '__protolab' in window, undefined, { timeout: 15_000 });

  const start = await page.evaluate(() => (window as unknown as { __protolab: ProtolabHook }).__protolab.cratePosition().y);
  await page.waitForTimeout(1000);
  const end = await page.evaluate(() => (window as unknown as { __protolab: ProtolabHook }).__protolab.cratePosition().y);

  // Physics is either alive or permanently dead — there is no in-between.
  expect(start - end, `crate did not fall: start=${start} end=${end}`).toBeGreaterThan(0.5);

  await page.screenshot({ path: 'artifacts/screens/skeleton.png' });
  await page.screenshot({ path: testInfo.outputPath('skeleton.png') });

  expect(errors, errors.join('\n')).toEqual([]);
});
