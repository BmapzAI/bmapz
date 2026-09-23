import js from '@eslint/js';
import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactRefreshPlugin from 'eslint-plugin-react-refresh';

export default [
  // Ignore node_modules, dist, and TypeScript files (no TS parser installed)
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'backend/node_modules/**',
      '*.config.js',
      'vite.config.*',
      'frontend-src/**/*.ts',  // TypeScript requires @typescript-eslint/parser
      'frontend-src/**/*.tsx',
    ],
  },

  // Base JS rules
  js.configs.recommended,

  // React files
  {
    files: ['frontend-src/**/*.{js,jsx,ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'react-refresh': reactRefreshPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // React
      'react/jsx-uses-react': 'off',     // Not needed with React 17+ JSX transform
      'react/react-in-jsx-scope': 'off', // Not needed with React 17+ JSX transform
      'react/prop-types': 'off',         // TypeScript / not enforced
      'react/display-name': 'off',

      // React Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // React Refresh (for Vite HMR)
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // General code quality — warnings only, not errors, to avoid blocking builds
      'no-unused-vars': ['warn', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
      // ERROR, not warn. An undefined identifier is a guaranteed runtime crash,
      // never a style preference: `<Star />` without importing Star took the
      // Company Admin Panel down with "Star is not defined". It was a warning,
      // and `eslint --quiet` (which shows errors only) hid it — so both the lint
      // and the build passed while the page was broken for every user.
      'no-undef': 'error',
      'no-console': 'off',
    },
  },

  // Backend: Express ESM on Node, not the browser.
  //
  // This was ignored entirely, so the whole API was unlinted. That is the same
  // hole the frontend `no-undef` comment above describes, only wider: an
  // undefined identifier in a route handler is a 500 for whoever hits it, and
  // nothing in `node --check`, the build, or the tests would surface it first.
  // Scoped to correctness rules rather than style, so turning it on reports real
  // latent crashes instead of drowning them in formatting noise.
  {
    files: ['backend/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
        fetch: 'readonly',           // native since Node 18; not in the `node` set
        FormData: 'readonly',
        Blob: 'readonly',
      },
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },

  // Maintenance scripts run in Node/CommonJS, not in the browser.
  {
    files: ['scripts/**/*.cjs'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'commonjs',
      },
    },
    rules: {
      'no-console': 'off',
      'no-undef': 'off',
      'no-func-assign': 'off',
    },
  },
];
