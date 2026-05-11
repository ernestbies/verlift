import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig({
  extends: [js.configs.recommended, tseslint.configs.recommended, prettierConfig],
  ignores: ['dist/**', 'node_modules/**'],
});
