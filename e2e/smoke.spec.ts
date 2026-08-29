import { expect, test } from '@playwright/test';

type ProtolabHook = {
  cratePosition: () => { x: number; y: number; z: number };
  playerPosition: () => { x: number; y: number; z: number };
  physicsAlive: () => number;
  stepForward: (on: boolean) => void;
  teleportPlayer: (x: number, y: number, z: number) => void;
  reset: () => void;
};

test('runtime boots and physics simulates', async ({ page }, testInfo) => {
  const errors: string[] = [];
  // Attach BEFORE goto, or early boot errors are missed.
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => { errors.push(`pageerror: ${err.message}`); });

  await page.goto('/');
  await page.waitForFunction(() => '__protolab' in window, undefined, { timeout: 15_000 });

  // Reset first so the crates are back at their spawn height with zero velocity —
  // measuring from page load races against how far they have already fallen.
  await page.evaluate(() => (window as unknown as { __protolab: ProtolabHook }).__protolab.reset());
  const start = await page.evaluate(() => (window as unknown as { __protolab: ProtolabHook }).__protolab.cratePosition().y);
  await page.waitForTimeout(1000);
  const end = await page.evaluate(() => (window as unknown as { __protolab: ProtolabHook }).__protolab.cratePosition().y);

  // Physics is either alive or permanently dead — there is no in-between.
  expect(start - end, `crate did not fall: start=${start} end=${end}`).toBeGreaterThan(0.5);

  await page.screenshot({ path: 'artifacts/screens/skeleton.png' });
  await page.screenshot({ path: testInfo.outputPath('skeleton.png') });

  expect(errors, errors.join('\n')).toEqual([]);
});

test('synthetic movement produces a position delta', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => '__protolab' in window);
  const before = await page.evaluate(() => (window as unknown as { __protolab: ProtolabHook }).__protolab.playerPosition());
  // Drives the controller input state via the __protolab hook: the controller's
  // keyboard source ignores synthetic key events without pointer lock (see bootstrap.ts).
  await page.evaluate(() => (window as unknown as { __protolab: ProtolabHook }).__protolab.stepForward(true));
  await page.waitForTimeout(800);
  await page.evaluate(() => (window as unknown as { __protolab: ProtolabHook }).__protolab.stepForward(false));
  const after = await page.evaluate(() => (window as unknown as { __protolab: ProtolabHook }).__protolab.playerPosition());
  const delta = Math.hypot(after.x - before.x, after.z - before.z);
  expect(delta, `player did not move: ${JSON.stringify({ before, after })}`).toBeGreaterThan(0.5);
});

test('reset restores the spawn state', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => '__protolab' in window);
  await page.evaluate(() => (window as unknown as { __protolab: ProtolabHook }).__protolab.teleportPlayer(9, 1, 9));
  await page.evaluate(() => (window as unknown as { __protolab: ProtolabHook }).__protolab.reset());
  await page.waitForTimeout(300);
  const p = await page.evaluate(() => (window as unknown as { __protolab: ProtolabHook }).__protolab.playerPosition());
  expect(Math.hypot(p.x, p.z)).toBeLessThan(0.5);
});
