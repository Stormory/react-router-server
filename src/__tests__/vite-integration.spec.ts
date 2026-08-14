import type { PreviewServer, ViteDevServer } from 'vite'

import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { createBuilder, createServer, preview } from 'vite'
import { afterEach, describe, expect, test } from 'vitest'

import { reactRouterServer } from '../plugin.js'

const EXPRESS_SOURCE = `
import express from "express";

const app = express();
app.use(express.text());
app.use((request, response) => {
  response.json({
    body: request.body,
    method: request.method,
    originalUrl: request.originalUrl,
  });
});

export async function bootstrap() {
  return app;
}
`

describe('Vite integration', () => {
  const roots: string[] = []
  let devServer: ViteDevServer | undefined
  let previewServer: PreviewServer | undefined

  afterEach(async () => {
    await Promise.all([devServer?.close(), previewServer?.close()])
    devServer = undefined
    previewServer = undefined
    await Promise.all(roots.splice(0).map((root) => fs.rm(root, { force: true, recursive: true })))
  })

  async function createFixture(): Promise<string> {
    const root = await fs.mkdtemp(path.join(process.cwd(), '.test-express-'))
    roots.push(root)
    await fs.writeFile(path.join(root, 'server.mjs'), EXPRESS_SOURCE)
    return root
  }

  test('serves the Express app in dev and build preview', async () => {
    const root = await createFixture()
    const createPlugin = () => reactRouterServer({ entry: 'server.mjs', entryName: 'server' })

    devServer = await createServer({
      configFile: false,
      logLevel: 'silent',
      plugins: [createPlugin()],
      root,
      server: { host: '127.0.0.1', port: 0 },
    })
    await devServer.listen()
    const devAddress = devServer.resolvedUrls?.local[0]
    if (!devAddress) {
      throw new Error('Expected a local development URL')
    }

    const devResponse = await fetch(new URL('/api/dev?ok=1', devAddress), {
      body: 'payload',
      method: 'POST',
    })
    expect(await devResponse.json()).toEqual({
      body: 'payload',
      method: 'POST',
      originalUrl: '/api/dev?ok=1',
    })
    await devServer.close()
    devServer = undefined

    const builder = await createBuilder({
      builder: {
        async buildApp(currentBuilder) {
          const environment = currentBuilder.environments.ssr
          if (!environment) {
            throw new Error('Expected the "ssr" build environment')
          }
          await currentBuilder.build(environment)
        },
      },
      configFile: false,
      logLevel: 'silent',
      plugins: [createPlugin()],
      root,
    })
    await builder.buildApp()

    const builtModule = (await import(path.join(root, 'dist', 'ssr', 'index.js'))) as { bootstrap?: unknown }
    expect(typeof builtModule.bootstrap).toBe('function')

    previewServer = await preview({
      configFile: false,
      logLevel: 'silent',
      plugins: [createPlugin()],
      preview: { host: '127.0.0.1', port: 0 },
      root,
    })
    const previewAddress = previewServer.resolvedUrls?.local[0]
    if (!previewAddress) {
      throw new Error('Expected a local preview URL')
    }

    const previewResponse = await fetch(new URL('/api/preview', previewAddress))
    expect(await previewResponse.json()).toMatchObject({
      method: 'GET',
      originalUrl: '/api/preview',
    })
  }, 30_000)
})
