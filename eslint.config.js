import react from 'eslint-plugin-react'
import js from '@eslint/js'

export default [
  js.configs.recommended,
  {
    ignores: ['server/**'],
  },
  {
    files: ['**/*.{js,jsx}'],
    plugins: { react },
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        document: 'readonly',
        window: 'readonly',
        navigator: 'readonly',
      },
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
    },
  },
]
