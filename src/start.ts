import { Command, InvalidArgumentError } from 'commander'
import * as http from 'node:http'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'

import type { FastifyApplication, ServerApplication } from './server-middleware.js'
import type { ReactRouterServerModule, ServerFramework } from './types.js'

import { resolveServerApplication } from './server-middleware.js'
import { isFunction, isObject } from './utils.js'

const DEFAULT_HOST = 'localhost'
const DEFAULT_PORT = 3000

export interface StartOptions {
  entry: string
  framework: ServerFramework
  host: string
  port: number
}

type StartAction = (options: StartOptions) => Promise<void>

export function createStartCommand(action: StartAction = start): Command {
  return new Command()
    .name('react-router-server')
    .description('Start a built @stormory/react-router-server entry')
    .argument('<server-entry>', 'path to the built server entry')
    .option('--framework <framework>', 'application framework', parseFramework, 'express')
    .option('--host <host>', 'host to listen on', parseHost, DEFAULT_HOST)
    .option('--port <port>', 'port to listen on', parsePort, DEFAULT_PORT)
    .allowExcessArguments(false)
    .showHelpAfterError()
    .action(async (entry: string, options: { framework: ServerFramework; host: string; port: number }) => {
      await action({ entry, framework: options.framework, host: options.host, port: options.port })
    })
}

export async function loadServerApplication(
  entry: string,
  framework: ServerFramework = 'express',
): Promise<ServerApplication> {
  const entryPath = path.resolve(process.cwd(), entry)
  const module = (await import(/* @vite-ignore */ pathToFileURL(entryPath).href)) as ReactRouterServerModule

  return resolveServerApplication(module, framework)
}

export async function startServerApplication(
  application: ServerApplication,
  options: Pick<StartOptions, 'framework' | 'host' | 'port'>,
): Promise<http.Server> {
  if (options.framework === 'fastify') {
    const fastifyApplication = application as FastifyApplication
    await fastifyApplication.listen({ port: options.port, host: options.host })
    if (!isHttpServer(fastifyApplication.server)) {
      throw new TypeError('The Fastify application must expose its HTTP server.')
    }
    await waitForListening(fastifyApplication.server)
    return fastifyApplication.server
  }

  const positionalApplication = application as Exclude<ServerApplication, FastifyApplication>
  const listenResult = positionalApplication.listen(options.port, options.host)
  const listening = isHttpServer(listenResult) ? waitForListening(listenResult) : undefined
  const server = await listenResult

  if (!isHttpServer(server)) {
    throw new TypeError('The application listen() method must return an HTTP server.')
  }

  await (listening ?? waitForListening(server))

  return server
}

export async function run(args = process.argv.slice(2)): Promise<void> {
  await createStartCommand().parseAsync(args, { from: 'user' })
}

async function start(options: StartOptions): Promise<void> {
  const application = await loadServerApplication(options.entry, options.framework)
  const server = await startServerApplication(application, options)
  const address = server.address()
  const port = isObject(address) ? address.port : options.port

  console.log(`Server listening on: http://${formatUrlHost(options.host)}:${port}`)
  installShutdownHandlers(application, server, options.framework)
}

function parseHost(value: string): string {
  if (value.length === 0) {
    throw new InvalidArgumentError('host must not be empty')
  }
  return value
}

function parsePort(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new InvalidArgumentError(`invalid port: ${value}`)
  }
  const port = Number(value)
  if (!Number.isSafeInteger(port) || port < 0 || port > 65_535) {
    throw new InvalidArgumentError(`invalid port: ${value}`)
  }
  return port
}

function parseFramework(value: string): ServerFramework {
  if (value === 'express' || value === 'fastify' || value === 'koa' || value === 'nest') {
    return value
  }
  throw new InvalidArgumentError(`invalid framework: ${value}`)
}

function formatUrlHost(host: string): string {
  return host.includes(':') && !host.startsWith('[') ? `[${host}]` : host
}

function isHttpServer(candidate: unknown): candidate is http.Server {
  if (!isObject(candidate)) {
    return false
  }

  const server = candidate as Partial<http.Server>
  return isFunction(server.address) && isFunction(server.close) && isFunction(server.once)
}

function waitForListening(server: http.Server): Promise<void> {
  if (server.listening) {
    return Promise.resolve()
  }

  return new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off('listening', onListening)
      reject(error)
    }
    const onListening = () => {
      server.off('error', onError)
      resolve()
    }

    server.once('error', onError)
    server.once('listening', onListening)
    if (server.listening) {
      onListening()
    }
  })
}

function installShutdownHandlers(
  application: ServerApplication,
  server: http.Server,
  framework: ServerFramework,
): void {
  let closing = false
  const close = () => {
    if (closing) {
      return
    }
    closing = true
    void closeServerApplication(application, server, framework).catch((error: unknown) => {
      console.error(error)
      process.exitCode = 1
    })
  }

  process.once('SIGINT', close)
  process.once('SIGTERM', close)
}

async function closeServerApplication(
  application: ServerApplication,
  server: http.Server,
  framework: ServerFramework,
): Promise<void> {
  if (framework === 'fastify' || framework === 'nest') {
    await (application as { close(): Promise<unknown> }).close()
    return
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}
