import tseslint from 'typescript-eslint';
import globals from 'globals';
export default tseslint.config(...tseslint.configs.recommended, {
  files: ['src/**/*.{ts,tsx}'],
  languageOptions: { globals: globals.browser },
  rules: { '@typescript-eslint/no-explicit-any': 'error' },
});
