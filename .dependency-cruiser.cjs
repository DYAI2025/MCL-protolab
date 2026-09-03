/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'runtime-not-to-experiments',
      severity: 'error',
      comment: 'src/runtime is engine integration only; it must never import experiment code.',
      from: { path: '^src/runtime/' },
      to: { path: '^experiments/' },
    },
    {
      name: 'core-not-to-experiments',
      severity: 'error',
      comment: 'src/core must not know about any concrete experiment.',
      from: { path: '^src/core/' },
      to: { path: '^experiments/' },
    },
    {
      name: 'core-not-to-runtime',
      severity: 'error',
      comment: 'src/core is engine-agnostic pure logic; it must not import src/runtime.',
      from: { path: '^src/core/' },
      to: { path: '^src/runtime/' },
    },
    {
      name: 'core-not-to-playcanvas',
      severity: 'error',
      comment: 'Only src/runtime may know the engine. Keeps core unit-testable without a browser.',
      from: { path: '^src/core/' },
      to: { path: 'node_modules/playcanvas' },
    },
    {
      name: 'shell-is-the-only-composition-root',
      severity: 'error',
      comment: 'Only src/shell may wire experiments to the runtime. Keeps the composition root single and findable.',
      from: { path: '^src/(runtime|core)/' },
      to: { path: '^src/shell/' },
    },
    {
      name: 'no-mc-legends-dependency',
      severity: 'error',
      comment: 'ADR-0002: the lab must never depend on the production web repo.',
      from: { path: '^(src|experiments)/' },
      to: { path: 'MC_legends' },
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    // doNotFollow keeps node_modules modules in the graph as leaves without
    // traversing into them. Do NOT add `exclude: node_modules` here: exclude
    // strips those modules from the graph entirely, which silently kills the
    // core-not-to-playcanvas rule (verified 2026-08-23 — the rule reported
    // clean against a file that imported playcanvas).
    doNotFollow: { path: 'node_modules' },
  },
};
