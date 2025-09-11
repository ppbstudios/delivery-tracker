const baseConfig = require('../../.eslintrc.js');

module.exports = {
  ...baseConfig,
  parser: '@typescript-eslint/parser',
  plugins: [...(baseConfig.plugins || []), '@typescript-eslint'],
  extends: [
    ...baseConfig.extends,
    'plugin:@typescript-eslint/recommended'
  ],
  parserOptions: {
    ...baseConfig.parserOptions,
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    ...baseConfig.rules,
    'prefer-promise-reject-errors': 'off',
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-require-imports': 'off',
    'import/extensions': 'off',
    'import/no-unresolved': 'off',
    'no-continue': 'off',
    'consistent-return': 'off'
  }
}
