import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['./src/index.ts'],
  outDir: './dist',
  platform: 'neutral',
  format: ['cjs', 'esm'],
});
