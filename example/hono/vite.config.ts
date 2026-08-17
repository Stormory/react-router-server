import { reactRouter } from '@react-router/dev/vite'
import { reactRouterServer } from '@stormory/react-router-server'
import { defineConfig } from 'vite'

export default defineConfig({
  root: import.meta.dirname,
  plugins: [reactRouterServer({ framework: 'hono' }), reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
})
