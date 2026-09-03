import boundaries from 'eslint-plugin-boundaries';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'artifacts/**', 'public/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    plugins: { boundaries },
    settings: {
      // REQUIRED. Without the resolver the boundaries rule silently passes on TS relative imports.
      'import/resolver': { typescript: { alwaysTryTypes: true } },
      'boundaries/elements': [
        { type: 'runtime', pattern: 'src/runtime/**' },
        { type: 'core', pattern: 'src/core/**' },
        { type: 'shell', pattern: 'src/shell/**' },
        { type: 'experiment', pattern: 'experiments/*/**' },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            { from: { element: { type: 'runtime' } }, allow: { to: { element: { types: { anyOf: ['runtime', 'core'] } } } } },
            { from: { element: { type: 'core' } }, allow: { to: { element: { type: 'core' } } } },
            { from: { element: { type: 'shell' } }, allow: { to: { element: { types: { anyOf: ['runtime', 'core', 'experiment'] } } } } },
            { from: { element: { type: 'experiment' } }, allow: { to: { element: { types: { anyOf: ['runtime', 'core', 'experiment'] } } } } },
          ],
        },
      ],
    },
  },
);
