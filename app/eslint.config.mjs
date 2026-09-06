import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

export default [
  {
    ignores: ['node_modules/**', '.next/**', 'next-env.d.ts'],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      // Downgraded, not dismissed. This rule fires on mount-time data fetches and on
      // components that seed editable state from props -- the notification loader and
      // the two document editors. Its own message says the pattern "is not
      // recommended" rather than incorrect, and the idiomatic fixes (move the fetch
      // server-side, adopt the render-phase prop-change pattern) are real refactors of
      // the approval path. Those want component tests first; see the follow-up note in
      // docs/OPERATIONS.md.
      'react-hooks/set-state-in-effect': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
];
