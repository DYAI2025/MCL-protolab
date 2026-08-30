import { expect, test } from '@playwright/test';

type EditorHook = {
  place: (assetId: string, x: number, z: number, behavior?: string) => Promise<unknown>;
  count: () => number;
  serialize: () => unknown;
};

const AUTOSAVE_KEY = 'mcl-protolab.world-editor.autosave';
const TEST_SESSION_KEY = 'mcl-protolab.test.production-persistence';

test.setTimeout(120_000);

test('production build restores a world-editor autosave after same-origin reload', async ({ page }) => {
  await page.addInitScript(({ autosaveKey, sessionKey }) => {
    if (sessionStorage.getItem(sessionKey) !== 'initialized') {
      localStorage.removeItem(autosaveKey);
      sessionStorage.setItem(sessionKey, 'initialized');
    }
  }, { autosaveKey: AUTOSAVE_KEY, sessionKey: TEST_SESSION_KEY });
  await page.goto('/?experiment=world-editor-v1');
  await page.waitForFunction(() => '__editor' in window, undefined, { timeout: 15_000 });

  await page.evaluate(async () => {
    const editor = (window as unknown as { __editor: EditorHook }).__editor;
    await editor.place('prop.zhalm.sensor-node.blockmodel', 4, -3, 'zhalm-node');
  });

  await expect.poll(() => page.evaluate(() => (
    window as unknown as { __editor: EditorHook }
  ).__editor.count())).toBe(1);

  const beforeReload = await page.evaluate(() => (
    window as unknown as { __editor: EditorHook }
  ).__editor.serialize());
  const storedBeforeReload = await page.evaluate((key) => localStorage.getItem(key), AUTOSAVE_KEY);
  expect(storedBeforeReload).not.toBeNull();

  await page.reload();
  await page.waitForFunction(() => '__editor' in window, undefined, { timeout: 15_000 });
  await expect.poll(() => page.evaluate(() => (
    window as unknown as { __editor: EditorHook }
  ).__editor.count()), { timeout: 30_000 }).toBe(1);

  const afterReload = await page.evaluate(() => (
    window as unknown as { __editor: EditorHook }
  ).__editor.serialize());
  expect(afterReload).toEqual(beforeReload);
});
