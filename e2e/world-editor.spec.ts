import { expect, test } from '@playwright/test';

type EditorHook = {
  place: (assetId: string, x: number, z: number, behavior?: string) => Promise<unknown>;
  count: () => number;
  serialize: () => unknown;
  load: (layout: unknown) => Promise<void>;
  setMode: (m: 'edit' | 'play') => void;
  mode: () => 'edit' | 'play';
  level: () => 'calm' | 'suspicious' | 'alerted';
  noiseAt: (x: number, z: number, r: number) => void;
  clear: () => void;
};

test.setTimeout(180_000); // V2 GLB loads + behavior sim under SwiftShader on CI

test('world editor: place, save/load roundtrip, play mode with live sound network', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => { errors.push(`pageerror: ${err.message}`); });

  await page.goto('/?experiment=world-editor-v1');
  await page.waitForFunction(() => '__editor' in window, undefined, { timeout: 15_000 });

  const hook = <R,>(fn: (h: EditorHook) => R) =>
    page.evaluate(fn as never as (h: unknown) => R, undefined) as Promise<R>;
  void hook; // page.evaluate needs inline closures below (serialization boundary)

  // Build a small encounter through the hook.
  await page.evaluate(async () => {
    const h = (window as unknown as { __editor: EditorHook }).__editor;
    await h.place('creature.mugosh.tripo-s1', -6, -8, 'mugosh-guardian');
    await h.place('prop.zhalm.sensor-node.blockmodel', 0, -10, 'zhalm-node');
    await h.place('prop.zhalm.sensor-node.blockmodel', 6, -12, 'zhalm-node');
    await h.place('creature.zhalm.blockmodel', 2, -18, 'zhalm-guardian');
  });
  expect(await page.evaluate(() => (window as unknown as { __editor: EditorHook }).__editor.count())).toBe(4);

  // Serialize -> clear -> load -> serialize must be identical.
  const first = await page.evaluate(() => (window as unknown as { __editor: EditorHook }).__editor.serialize());
  await page.evaluate(async () => {
    const h = (window as unknown as { __editor: EditorHook }).__editor;
    const layout = h.serialize();
    h.clear();
    await h.load(layout);
  });
  const second = await page.evaluate(() => (window as unknown as { __editor: EditorHook }).__editor.serialize());
  expect(second).toEqual(first);

  await page.screenshot({ path: 'artifacts/screens/world-editor.png' });
  await page.screenshot({ path: testInfo.outputPath('world-editor.png') });

  // Play mode: player drops in, placed nodes form a live network.
  await page.evaluate(() => (window as unknown as { __editor: EditorHook }).__editor.setMode('play'));
  expect(await page.evaluate(() => (window as unknown as { __editor: EditorHook }).__editor.mode())).toBe('play');
  expect(await page.evaluate(() => (window as unknown as { __editor: EditorHook }).__editor.level())).toBe('calm');
  await page.evaluate(() => {
    const h = (window as unknown as { __editor: EditorHook }).__editor;
    h.noiseAt(0, -10, 6); h.noiseAt(0, -10, 6); h.noiseAt(0, -10, 6);
  });
  expect(await page.evaluate(() => (window as unknown as { __editor: EditorHook }).__editor.level())).toBe('alerted');

  // Let the guardian move and the pulses travel before the evidence shot.
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'artifacts/screens/world-play.png' });
  await page.screenshot({ path: testInfo.outputPath('world-play.png') });

  expect(errors, errors.join('\n')).toEqual([]);
});
