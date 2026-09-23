import { expect, test, type Page } from '@playwright/test';

type ProposalView = { id: string; intent: string; summary: string; status: 'accepted' | 'rejected'; reasons: string[] };
type DirectorHook = {
  flags: () => Record<string, boolean>;
  revision: () => number;
  observedTypes: () => string[];
  runStatus: () => string | null;
  proposals: () => ProposalView[];
  select: (proposalId: string) => { ok: boolean; reason?: string };
  guardianMode: () => string;
  clusterBActive: () => boolean;
};
type ZhalmHook = {
  noiseAt: (x: number, z: number, radius: number) => void;
  nodeEnergy: (id: string) => number;
  guardianPosition: () => { x: number; y: number; z: number };
  director: DirectorHook;
};
type Win = { __zhalm: ZhalmHook; __protolab: { reset: () => void } };

const ALL_FALSE = {
  'zhalm.guardian.investigating': false,
  'zhalm.cluster-b.active': false,
  'zhalm.network.regrouping': false,
};

// Forest + fog + post under SwiftShader: generous budget like the other forest specs.
test.setTimeout(120_000);

const collectErrors = (page: Page): string[] => {
  const errors: string[] = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => { errors.push(`pageerror: ${err.message}`); });
  return errors;
};

const openForest = async (page: Page): Promise<void> => {
  await page.goto('/?experiment=zhalm-forest-v1');
  await page.waitForFunction(() => 'director' in ((window as unknown as Partial<Win>).__zhalm ?? {}), undefined, { timeout: 15_000 });
};

// A real browser-side sound event: the same noise path player movement uses.
const raiseAlert = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const zhalm = (window as unknown as Win).__zhalm;
    zhalm.noiseAt(0, 0, 6); zhalm.noiseAt(0, 0, 6); zhalm.noiseAt(0, 0, 6);
  });
  await page.waitForFunction(() => (window as unknown as Win).__zhalm.director.runStatus() === 'STOPPED', undefined, { timeout: 20_000 });
};

const flags = (page: Page) => page.evaluate(() => (window as unknown as Win).__zhalm.director.flags());

test('director slice: noise → policy-gated proposals → human choice → visible consequence → reset', async ({ page }, testInfo) => {
  const errors = collectErrors(page);
  await openForest(page);

  expect(await flags(page)).toEqual(ALL_FALSE);
  expect(await page.evaluate(() => (window as unknown as Win).__zhalm.director.revision())).toBe(1);
  await expect(page.locator('[data-director-proposal]')).toHaveCount(0);

  await raiseAlert(page);

  // AC1: the browser-side event chain reached the ledger as observed WorldEvents.
  const observed = await page.evaluate(() => (window as unknown as Win).__zhalm.director.observedTypes());
  expect(observed).toEqual(expect.arrayContaining(['NOISE_EMITTED', 'SENSOR_TRIGGERED', 'NETWORK_ALERT']));

  // AC2 + AC3: three valid alternatives; the gate-rejected one is not selectable.
  const proposals = await page.evaluate(() => (window as unknown as Win).__zhalm.director.proposals());
  expect(proposals.filter((p) => p.status === 'accepted').map((p) => p.intent))
    .toEqual(['guardian_investigates_noise', 'activate_second_sensor_cluster', 'network_retreat_regroup']);
  const rejected = proposals.filter((p) => p.status === 'rejected');
  expect(rejected.map((p) => p.reasons)).toEqual([['REQUIRED_FACT_MISSING']]);
  await expect(page.locator('[data-director-proposal][data-gate-status="accepted"] button')).toHaveCount(3);
  await expect(page.locator('[data-director-proposal][data-gate-status="rejected"] button')).toBeDisabled();
  const refused = await page.evaluate((id) => (window as unknown as Win).__zhalm.director.select(id), rejected[0]?.id ?? '');
  expect(refused).toMatchObject({ ok: false, reason: 'PROPOSAL_REJECTED' });
  expect(await flags(page)).toEqual(ALL_FALSE);

  // AC4: a human click applies the reaction to the WorldState and the running forest.
  await page.locator('[data-director-proposal][data-gate-status="accepted"][data-intent="activate_second_sensor_cluster"] button').click();
  await page.waitForFunction(() => (window as unknown as Win).__zhalm.director.flags()['zhalm.cluster-b.active'] === true);
  expect(await flags(page)).toEqual({ ...ALL_FALSE, 'zhalm.cluster-b.active': true });
  expect(await page.evaluate(() => (window as unknown as Win).__zhalm.director.revision())).toBe(2);
  await expect(page.locator('[data-director-result]')).toContainText('zhalm.cluster-b.active');
  // The runtime reads the flag on its next frame.
  await page.waitForFunction(() => (window as unknown as Win).__zhalm.director.clusterBActive());
  await page.evaluate(() => (window as unknown as Win).__zhalm.noiseAt(0, 16, 3));
  expect(await page.evaluate(() => (window as unknown as Win).__zhalm.nodeEnergy('b2'))).toBeGreaterThan(0.5);

  await page.screenshot({ path: 'artifacts/screens/zhalm-director.png' });
  await page.screenshot({ path: testInfo.outputPath('zhalm-director.png') });

  // AC5: experiment reset restores the initial world and removes the reaction.
  await page.evaluate(() => (window as unknown as Win).__protolab.reset());
  await page.waitForFunction(() => {
    const director = (window as unknown as Partial<Win>).__zhalm?.director;
    return director !== undefined && director.revision() === 1 && director.runStatus() === null;
  });
  expect(await flags(page)).toEqual(ALL_FALSE);
  expect(await page.evaluate(() => (window as unknown as Win).__zhalm.director.clusterBActive())).toBe(false);
  await expect(page.locator('[data-director-proposal]')).toHaveCount(0);

  expect(errors, errors.join('\n')).toEqual([]);
});

test('director slice: the regroup reaction pulls the guardian back towards the grove heart', async ({ page }) => {
  const errors = collectErrors(page);
  await openForest(page);
  await raiseAlert(page);

  const heartZ = -29;
  const before = await page.evaluate(() => (window as unknown as Win).__zhalm.guardianPosition());
  await page.locator('[data-director-proposal][data-gate-status="accepted"][data-intent="network_retreat_regroup"] button').click();
  await page.waitForFunction(() => (window as unknown as Win).__zhalm.director.flags()['zhalm.network.regrouping'] === true);
  await page.waitForFunction(() => (window as unknown as Win).__zhalm.director.guardianMode() === 'regrouping');

  // Poll instead of sleeping: SwiftShader frame rates vary, the direction must not.
  await page.waitForFunction(
    ([startDistance, target]) => {
      const z = (window as unknown as Win).__zhalm.guardianPosition().z;
      return Math.abs(z - (target as number)) < (startDistance as number) - 2;
    },
    [Math.abs(before.z - heartZ), heartZ],
    { timeout: 20_000 },
  );

  expect(errors, errors.join('\n')).toEqual([]);
});
