import { expect, test } from '@playwright/test';

type BlockGalleryHook = {
  ids: () => string[];
  loaded: (id: string) => boolean | null;
  allLoaded: () => boolean;
  usedFallback: (id: string) => boolean | null;
};

// Eleven registry models, four of them 4 MB textured V2 GLBs, all through
// SwiftShader on CI — triple the local-comfortable budget.
test.setTimeout(180_000);

test('all generated block models load through the registry without fallbacks', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => { errors.push(`pageerror: ${err.message}`); });

  await page.goto('/?experiment=blockmodel-gallery-v1');
  await page.waitForFunction(() => '__blockgallery' in window, undefined, { timeout: 15_000 });

  await page.waitForFunction(
    () => (window as unknown as { __blockgallery: BlockGalleryHook }).__blockgallery.allLoaded(),
    undefined,
    { timeout: 20_000 },
  );

  const ids = await page.evaluate(() => (window as unknown as { __blockgallery: BlockGalleryHook }).__blockgallery.ids());
  expect(ids).toHaveLength(11); // 7 graybox block models + 4 V2 Tripo candidates
  for (const id of ids) {
    const fallback = await page.evaluate(
      ([assetId]) => (window as unknown as { __blockgallery: BlockGalleryHook }).__blockgallery.usedFallback(assetId as string),
      [id],
    );
    expect(fallback, `${id} should load directly, not via fallback`).toBe(false);
  }

  // Let shadows/frames settle for the evidence shot.
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'artifacts/screens/blockmodel-gallery.png' });
  await page.screenshot({ path: testInfo.outputPath('blockmodel-gallery.png') });

  expect(errors, errors.join('\n')).toEqual([]);
});
