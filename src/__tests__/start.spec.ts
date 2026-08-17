import type { AddressInfo } from 'node:net'

import * as fs from 'node:fs/promises'
import { createServer } from 'node:http'
import * as path from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { createStartCommand, loadServerApplication, startServerApplication } from '../start.js'

describe('createStartCommand', () => {
  test('uses the default host and port', async () => {
    const action = vi.fn(async () => {})

    await createStartCommand(action).parseAsync(['build/server/index.js'], {
      from: 'user',
    })

    expect(action).toHaveBeenCalledWith({
      entry: 'build/server/index.js',
      framework: 'express',
      host: 'localhost',
      port: 3000,
    })
  })

  test('accepts equals and separate option values', async () => {
    const action = vi.fn(async () => {})

    await createStartCommand(action).parseAsync(
      ['build/server/index.js', '--framework=koa', '--host=0.0.0.0', '--port', '8080'],
      {
        from: 'user',
      },
    )

    expect(action).toHaveBeenCalledWith({
      entry: 'build/server/index.js',
      framework: 'koa',
      host: '0.0.0.0',
      port: 8080,
    })
  })

  test('accepts Hono as the application framework', async () => {
    const action = vi.fn(async () => {})

    await createStartCommand(action).parseAsync(['build/server/index.js', '--framework=hono'], {
      from: 'user',
    })

    expect(action).toHaveBeenCalledWith({
      entry: 'build/server/index.js',
      framework: 'hono',
      host: 'localhost',
      port: 3000,
    })
  })

  test.each([
    [[], 'missing required argument'],
    [['entry.js', 'other.js'], 'too many arguments'],
    [['entry.js', '--unknown'], 'unknown option'],
    [['entry.js', '--framework=rails'], 'invalid framework'],
    [['entry.js', '--host='], 'host must not be empty'],
    [['entry.js', '--port=nope'], 'invalid port'],
    [['entry.js', '--port=65536'], 'invalid port'],
  ])('rejects invalid arguments: %j', async (args, message) => {
    const command = createStartCommand(vi.fn(async () => {}))
      .exitOverride()
      .configureOutput({ writeErr: () => {} })

    await expect(command.parseAsync(args, { from: 'user' })).rejects.toThrow(message)
  })
})

describe('start CLI runtime', () => {
  const temporaryDirectories: string[] = []
  const servers: import('node:http').Server[] = []

  afterEach(async () => {
    await Promise.all(
      servers
        .splice(0)
        .map(
          (server) =>
            new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
        ),
    )
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })),
    )
  })

  test('loads bootstrap and serves its Express-compatible application', async () => {
    const directory = await fs.mkdtemp(path.join(process.cwd(), '.test-start-'))
    temporaryDirectories.push(directory)
    const entry = path.join(directory, 'server.mjs')
    await fs.writeFile(
      entry,
      `import express from "express";
const application = express();
application.get("/", (_request, response) => response.end("started"));
export async function bootstrap() {
  return application;
}
`,
    )

    const application = await loadServerApplication(entry)
    const server = await startServerApplication(application, {
      framework: 'express',
      host: '127.0.0.1',
      port: 0,
    })
    servers.push(server)
    const { port } = server.address() as AddressInfo

    await expect(fetch(`http://127.0.0.1:${port}`)).resolves.toMatchObject({
      status: 200,
    })
  })

  test('starts Nest through the original application listen method', async () => {
    const application = {
      close: vi.fn(async () => {}),
      getHttpAdapter: vi.fn(() => ({ getInstance: vi.fn(), getType: vi.fn(() => 'express') })),
      init: vi.fn(async () => application),
      listen: vi.fn((port: number, host: string) => {
        return new Promise<import('node:http').Server>((resolve) => {
          const server = createServer((_request, response) => response.end('started'))
          server.listen(port, host, () => resolve(server))
        })
      }),
    }

    const server = await startServerApplication(application, {
      framework: 'nest',
      host: '127.0.0.1',
      port: 0,
    })
    servers.push(server)

    expect(application.listen).toHaveBeenCalledWith(0, '127.0.0.1')
    expect(application.init).not.toHaveBeenCalled()
  })

  test('starts Fastify with listen options and returns its server', async () => {
    const nativeServer = createServer((_request, response) => response.end('started'))
    const application = {
      close: vi.fn(async () => {}),
      listen: vi.fn(({ port, host }: { host: string; port: number }) => {
        return new Promise<string>((resolve) => {
          nativeServer.listen(port, host, () => resolve(`http://${host}`))
        })
      }),
      ready: vi.fn(async () => {}),
      routing: vi.fn(),
      server: nativeServer,
    }

    const server = await startServerApplication(application, {
      framework: 'fastify',
      host: '127.0.0.1',
      port: 0,
    })
    servers.push(server)

    expect(server).toBe(nativeServer)
    expect(application.listen).toHaveBeenCalledWith({ host: '127.0.0.1', port: 0 })
  })

  test('starts a Fetch-native Hono application with a Node server', async () => {
    const application = {
      fetch: vi.fn(async (request: Request) => {
        return Response.json({ method: request.method, url: request.url })
      }),
    }

    const server = await startServerApplication(application, {
      framework: 'hono',
      host: '127.0.0.1',
      port: 0,
    })
    servers.push(server)
    const { port } = server.address() as AddressInfo

    const response = await fetch(`http://127.0.0.1:${port}/api/hello`)
    await expect(response.json()).resolves.toEqual({
      method: 'GET',
      url: `http://127.0.0.1:${port}/api/hello`,
    })
    expect(application.fetch).toHaveBeenCalledOnce()
  })

  test('rejects a build without bootstrap', async () => {
    const directory = await fs.mkdtemp(path.join(process.cwd(), '.test-start-'))
    temporaryDirectories.push(directory)
    const entry = path.join(directory, 'server.mjs')
    await fs.writeFile(entry, 'export const value = true;\n')

    await expect(loadServerApplication(entry)).rejects.toThrow('must export a "bootstrap" function')
  })
})
