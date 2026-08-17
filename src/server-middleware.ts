import type * as http from 'node:http'

import type { NodeMiddleware } from './node-middleware.js'
import type { ReactRouterServerModule, ServerFramework } from './types.js'

import { isFunction, isObject } from './utils.js'

const INVALID_NEST_ADAPTER_MESSAGE = 'The Nest application must use an Express or Fastify HTTP adapter.'
const FRAMEWORK_NAMES: Record<ServerFramework, string> = {
  express: 'Express',
  fastify: 'Fastify',
  koa: 'Koa',
  nest: 'Nest',
}

type LoadServerModule = () => Promise<ReactRouterServerModule>

type ExpressApplication = NodeMiddleware & {
  handle: (...parameters: unknown[]) => unknown
  listen(port: number, host: string): http.Server
  use: (...parameters: unknown[]) => unknown
}

interface NestHttpAdapter {
  getInstance(): unknown
  getType(): string
}

interface NestApplication {
  close(): Promise<unknown>
  getHttpAdapter(): NestHttpAdapter
  init(): Promise<unknown>
  listen(port: number, host: string): Promise<unknown>
}

export interface FastifyApplication {
  close(): Promise<unknown>
  listen(options: { host: string; port: number }): Promise<unknown>
  ready(): PromiseLike<unknown>
  routing(request: http.IncomingMessage, response: http.ServerResponse): unknown
  server: http.Server
}

interface KoaApplication {
  callback(): http.RequestListener
  listen(port: number, host: string): http.Server
  use(...parameters: unknown[]): unknown
}

export type ServerApplication = ExpressApplication | FastifyApplication | KoaApplication | NestApplication

/** Load an application module and adapt it to Vite's Connect middleware API. */
export function createServerModuleMiddleware(
  loadModule: LoadServerModule,
  framework: ServerFramework = 'express',
): NodeMiddleware {
  let loadedModule: ReactRouterServerModule | undefined
  let middlewarePromise: Promise<NodeMiddleware> | undefined

  return async (request, response, next) => {
    try {
      const module = await loadModule()
      if (module !== loadedModule || !middlewarePromise) {
        loadedModule = module
        middlewarePromise = resolveServerMiddleware(module, framework)
      }
      const middleware = await middlewarePromise
      await middleware(request, response, next)
    } catch (error) {
      next(error)
    }
  }
}

/** Bootstrap and preserve the original configured framework application. */
export async function resolveServerApplication(
  module: ReactRouterServerModule,
  framework: ServerFramework = 'express',
): Promise<ServerApplication> {
  const bootstrap = module.bootstrap
  if (!isFunction(bootstrap)) {
    throw new TypeError(invalidEntryMessage(framework))
  }

  const application = await bootstrap()
  assertFrameworkApplication(application, framework)
  return application
}

/** Resolve a Connect-compatible middleware for the configured application framework. */
export async function resolveServerMiddleware(
  module: ReactRouterServerModule,
  framework: ServerFramework = 'express',
): Promise<NodeMiddleware> {
  const application = await resolveServerApplication(module, framework)

  switch (framework) {
    case 'express':
      return application as ExpressApplication
    case 'fastify':
      return resolveFastifyMiddleware(application as FastifyApplication)
    case 'koa':
      return resolveKoaMiddleware(application as KoaApplication)
    case 'nest':
      return resolveNestMiddleware(application as NestApplication)
  }
}

async function resolveNestMiddleware(application: NestApplication): Promise<NodeMiddleware> {
  await application.init()
  const adapter = application.getHttpAdapter()
  const adapterApplication = adapter.getInstance()

  switch (adapter.getType()) {
    case 'express':
      assertMethods(adapterApplication, ['handle', 'use'], INVALID_NEST_ADAPTER_MESSAGE)
      if (!isFunction(adapterApplication)) {
        throw new TypeError(INVALID_NEST_ADAPTER_MESSAGE)
      }
      return adapterApplication as NodeMiddleware

    case 'fastify':
      assertMethods(adapterApplication, ['ready', 'routing'], INVALID_NEST_ADAPTER_MESSAGE)
      return resolveFastifyMiddleware(adapterApplication as FastifyApplication)

    default:
      throw new TypeError(INVALID_NEST_ADAPTER_MESSAGE)
  }
}

async function resolveFastifyMiddleware(application: FastifyApplication): Promise<NodeMiddleware> {
  await application.ready()
  return (request, response) => {
    application.routing(request, response)
  }
}

function resolveKoaMiddleware(application: KoaApplication): NodeMiddleware {
  const callback = application.callback()
  return (request, response) => callback(request, response)
}

function assertFrameworkApplication(
  application: unknown,
  framework: ServerFramework,
): asserts application is ServerApplication {
  const errorMessage = invalidEntryMessage(framework)
  switch (framework) {
    case 'express':
      assertMethods(application, ['handle', 'listen', 'use'], errorMessage)
      return
    case 'fastify':
      assertMethods(application, ['close', 'listen', 'ready', 'routing'], errorMessage)
      if (!isObject((application as Partial<FastifyApplication>).server)) {
        throw new TypeError(errorMessage)
      }
      return
    case 'koa':
      assertMethods(application, ['callback', 'listen', 'use'], errorMessage)
      return
    case 'nest':
      assertMethods(application, ['close', 'getHttpAdapter', 'init', 'listen'], errorMessage)
  }
}

function assertMethods(application: unknown, methods: string[], errorMessage: string): void {
  if (!isObject(application) && !isFunction(application)) {
    throw new TypeError(errorMessage)
  }

  const record = application as Record<string, unknown>
  if (methods.some((method) => !isFunction(record[method]))) {
    throw new TypeError(errorMessage)
  }
}

function invalidEntryMessage(framework: ServerFramework): string {
  return `The server entry must export a "bootstrap" function that returns ${FRAMEWORK_NAMES[framework]} application.`
}
