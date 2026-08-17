import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'

import { dashboard } from './controller/dashboard'
import { hello } from './controller/hello'

export function bootstrap() {
  const app = new Hono()

  // Static assets
  app.use(
    '/assets/*',
    serveStatic({
      onFound(_path, context) {
        context.header('Cache-Control', 'public, max-age=31536000, immutable')
      },
      root: './build/client',
    }),
  )
  app.use('*', serveStatic({ root: './build/client' }))

  // Routes
  app.get('/api/hello', hello)
  app.all('*', dashboard)

  return app
}
