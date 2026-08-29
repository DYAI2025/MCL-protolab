import { expect, test } from '@playwright/test';

type GalleryHook = {
  ids: () => string[];
  states: (id: string) => string[];
  state: (id: string) => string | null;
  setState: (id: string, state: string) => void;
  readabilityGoal: (id: string) => string;
};

// The gallery renders HDR + 4x MSAA bloom through SwiftShader in CI — frames
// are slow, so this spec gets triple the default budget.
test.setTimeout(90_000);

test('the creature FX gallery loads all four concepts and their states are activatable', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => { errors.push(`pageerror: ${err.message}`); });

  await page.goto('/?experiment=creature-fx-gallery');
  await page.waitForFunction(() => '__gallery' in window, undefined, { timeout: 15_000 });

  const ids = await page.evaluate(() => (window as unknown as { __gallery: GalleryHook }).__gallery.ids());
  expect(ids.sort()).toEqual(['flammenwolf', 'mugosh', 'veras', 'zhalm']);

  // Addendum §6: at least one deterministic FX state per profile, activatable
  // from a test hook. Activate a non-default state and read it back.
  const targetStates: Record<string, string> = {
    mugosh: 'hostile',
    flammenwolf: 'prowling',
    veras: 'drifting',
    zhalm: 'pulse',
  };
  for (const [id, state] of Object.entries(targetStates)) {
    const declared = await page.evaluate(
      ([creatureId]) => (window as unknown as { __gallery: GalleryHook }).__gallery.states(creatureId as string),
      [id],
    );
    expect(declared, `${id} must declare ${state}`).toContain(state);
    await page.evaluate(
      ([creatureId, next]) => (window as unknown as { __gallery: GalleryHook }).__gallery.setState(creatureId as string, next as string),
      [id, state],
    );
    const active = await page.evaluate(
      ([creatureId]) => (window as unknown as { __gallery: GalleryHook }).__gallery.state(creatureId as string),
      [id],
    );
    expect(active, `${id} state did not activate`).toBe(state);
  }

  // Let the activated states animate (wolf prowl + trail, zhalm pulse) before the evidence shot.
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'artifacts/screens/creature-gallery.png' });
  await page.screenshot({ path: testInfo.outputPath('creature-gallery.png') });

  expect(errors, errors.join('\n')).toEqual([]);
});
