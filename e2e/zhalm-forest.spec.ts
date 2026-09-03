import { expect, test } from '@playwright/test';

type ZhalmHook = {
  level: () => 'calm' | 'suspicious' | 'alerted';
  stimulation: () => number;
  noiseAt: (x: number, z: number, radius: number) => void;
  nodeEnergy: (id: string) => number;
  guardianPosition: () => { x: number; y: number; z: number };
  lastNoise: () => { x: number; z: number } | null;
  score: () => { wins: number; catches: number };
};

// Forest + fog under SwiftShader — same latency budget as the gallery spec.
test.setTimeout(90_000);

test('the sound network escalates on noise and the guardian investigates', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => { errors.push(`pageerror: ${err.message}`); });

  await page.goto('/?experiment=zhalm-forest-v1');
  await page.waitForFunction(() => '__zhalm' in window, undefined, { timeout: 15_000 });

  const level = () => page.evaluate(() => (window as unknown as { __zhalm: ZhalmHook }).__zhalm.level());

  // Starts calm.
  expect(await level()).toBe('calm');

  // Loud noise right on node n3 (0,0) — three bursts escalate past alerted.
  await page.evaluate(() => {
    const z = (window as unknown as { __zhalm: ZhalmHook }).__zhalm;
    z.noiseAt(0, 0, 6); z.noiseAt(0, 0, 6); z.noiseAt(0, 0, 6);
  });
  expect(await level()).toBe('alerted');

  // The struck node is hot, and the pulse cascade reaches a linked neighbour.
  const hot = await page.evaluate(() => (window as unknown as { __zhalm: ZhalmHook }).__zhalm.nodeEnergy('n3'));
  expect(hot).toBeGreaterThan(0.5);
  await page.waitForFunction(
    () => (window as unknown as { __zhalm: ZhalmHook }).__zhalm.nodeEnergy('n1') > 0.1
      || (window as unknown as { __zhalm: ZhalmHook }).__zhalm.nodeEnergy('n2') > 0.1
      || (window as unknown as { __zhalm: ZhalmHook }).__zhalm.nodeEnergy('n4') > 0.1,
    undefined,
    { timeout: 10_000 },
  );

  // Guardian closes in on the noise position (player spawn is far away at z=30).
  const before = await page.evaluate(() => (window as unknown as { __zhalm: ZhalmHook }).__zhalm.guardianPosition());
  const d0 = Math.hypot(before.x - 0, before.z - 0);
  await page.waitForTimeout(2500);
  const after = await page.evaluate(() => (window as unknown as { __zhalm: ZhalmHook }).__zhalm.guardianPosition());
  const d1 = Math.hypot(after.x - 0, after.z - 0);
  expect(d1, `guardian did not move toward the noise: ${d0} -> ${d1}`).toBeLessThan(d0);

  await page.screenshot({ path: 'artifacts/screens/zhalm-forest.png' });
  await page.screenshot({ path: testInfo.outputPath('zhalm-forest.png') });

  expect(errors, errors.join('\n')).toEqual([]);
});
