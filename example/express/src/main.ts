import express from 'express'
import path from 'node:path'

import { dashboard } from './controller/dashboard'
import { hello } from './controller/hello'

export async function bootstrap() {
  const app = express()
  const clientDirectory = path.resolve('build/client')

  // Static assets
  app.use(
    '/assets',
    express.static(path.join(clientDirectory, 'assets'), {
      immutable: true,
      maxAge: '1y',
    }),
  )
  app.use(express.static(clientDirectory))

  // Routes
  app.get('/api/hello', hello)
  app.use(dashboard)

  return app
}
