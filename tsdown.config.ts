import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    start: 'src/start.ts',
  },
  platform: 'node',
  outDir: 'dist',
  tsconfig: 'tsconfig.json',
  treeshake: true,
  clean: true,
  dts: true,
  deps: {
    neverBundle: ['commander', 'vite'],
  },
})
