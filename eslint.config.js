import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    // Vendored, unmodified three.js Draco decoder (Apache-2.0).
    ignores: [
      'dist/**',
      'dist-benchmark/**',
      'node_modules/**',
      'public/assets/draco/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
);
