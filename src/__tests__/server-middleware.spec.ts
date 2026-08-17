import type { Server, ServerResponse } from 'node:http'

import { describe, expect, test, vi } from 'vitest'

import {
  createServerModuleMiddleware,
  resolveServerApplication,
  resolveServerMiddleware,
} from '../server-middleware.js'

function createExpressApplication() {
  return Object.assign(vi.fn(), {
    handle: vi.fn(),
    listen: vi.fn(),
    use: vi.fn(),
  })
}

function createFastifyApplication() {
  return {
    close: vi.fn(async () => {}),
    listen: vi.fn(async () => 'http://localhost'),
    ready: vi.fn(async () => {}),
    routing: vi.fn(),
    server: {} as Server,
  }
}

describe('resolveServerMiddleware', () => {
  test('resolves the Express application returned by bootstrap', async () => {
    const application = createExpressApplication()

    await expect(resolveServerMiddleware({ bootstrap: async () => application })).resolves.toBe(application)
  })

  test('initializes a Nest application and resolves its Express adapter', async () => {
    const adapterApplication = createExpressApplication()
    const application = {
      close: vi.fn(async () => {}),
      getHttpAdapter: vi.fn(() => ({
        getInstance: vi.fn(() => adapterApplication),
        getType: vi.fn(() => 'express'),
      })),
      init: vi.fn(async () => application),
      listen: vi.fn(),
    }

    await expect(resolveServerMiddleware({ bootstrap: async () => application }, 'nest')).resolves.toBe(
      adapterApplication,
    )
    expect(application.init).toHaveBeenCalledOnce()
    expect(application.getHttpAdapter).toHaveBeenCalledOnce()
  })

  test('adapts a Nest application backed by Fastify', async () => {
    const adapterApplication = createFastifyApplication()
    const application = {
      close: vi.fn(async () => {}),
      getHttpAdapter: vi.fn(() => ({
        getInstance: vi.fn(() => adapterApplication),
        getType: vi.fn(() => 'fastify'),
      })),
      init: vi.fn(async () => application),
      listen: vi.fn(),
    }
    const middleware = await resolveServerMiddleware({ bootstrap: async () => application }, 'nest')
    const request = { url: '/native' } as never
    const response = {} as ServerResponse

    await middleware(request, response, vi.fn())

    expect(application.init).toHaveBeenCalledOnce()
    expect(adapterApplication.ready).toHaveBeenCalledOnce()
    expect(adapterApplication.routing).toHaveBeenCalledWith(request, response)
  })

  test('preserves the Nest application returned by bootstrap', async () => {
    const application = {
      close: vi.fn(async () => {}),
      getHttpAdapter: vi.fn(),
      init: vi.fn(async () => application),
      listen: vi.fn(),
    }

    await expect(resolveServerApplication({ bootstrap: async () => application }, 'nest')).resolves.toBe(application)
  })

  test('resolves a raw Fastify application through routing()', async () => {
    const application = createFastifyApplication()
    const middleware = await resolveServerMiddleware({ bootstrap: async () => application }, 'fastify')
    const request = { url: '/native' } as never
    const response = {} as ServerResponse

    await middleware(request, response, vi.fn())

    expect(application.ready).toHaveBeenCalledOnce()
    expect(application.routing).toHaveBeenCalledWith(request, response)
  })

  test('resolves a Koa application through callback()', async () => {
    const handler = vi.fn()
    const application = {
      callback: vi.fn(() => handler),
      listen: vi.fn(),
      use: vi.fn(),
    }
    const middleware = await resolveServerMiddleware({ bootstrap: async () => application }, 'koa')
    const request = { url: '/native' } as never
    const response = {} as ServerResponse

    await middleware(request, response, vi.fn())

    expect(application.callback).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith(request, response)
  })

  test('rejects a Nest application with an unsupported HTTP adapter', async () => {
    const application = {
      close: vi.fn(async () => {}),
      getHttpAdapter: vi.fn(() => ({
        getInstance: vi.fn(() => ({})),
        getType: vi.fn(() => 'custom'),
      })),
      init: vi.fn(async () => application),
      listen: vi.fn(),
    }

    await expect(resolveServerMiddleware({ bootstrap: async () => application }, 'nest')).rejects.toThrow(
      'must use an Express or Fastify HTTP adapter',
    )
  })

  test('rejects an application that does not match the configured framework', async () => {
    const application = createFastifyApplication()

    await expect(resolveServerMiddleware({ bootstrap: async () => application }, 'koa')).rejects.toThrow(
      'returns Koa application',
    )
  })

  test('rejects a missing bootstrap export', async () => {
    await expect(resolveServerMiddleware({})).rejects.toThrow('must export a "bootstrap" function')
  })

  test('rejects an unsupported bootstrap result', async () => {
    await expect(resolveServerMiddleware({ bootstrap: vi.fn() })).rejects.toThrow('returns Express application')
  })
})

describe('createServerModuleMiddleware', () => {
  test('passes the original request, response, and next function to Express', async () => {
    const application = createExpressApplication()
    const bootstrap = vi.fn(async () => application)
    const module = { bootstrap }
    const middleware = createServerModuleMiddleware(async () => ({
      ...module,
    }))
    const request = { url: '/native' } as never
    const response = {} as ServerResponse
    const next = vi.fn()

    await middleware(request, response, next)

    expect(application).toHaveBeenCalledWith(request, response, next)
  })

  test('bootstraps and initializes the same Nest module only once', async () => {
    const adapterApplication = createExpressApplication()
    const application = {
      close: vi.fn(async () => {}),
      getHttpAdapter: vi.fn(() => ({
        getInstance: vi.fn(() => adapterApplication),
        getType: vi.fn(() => 'express'),
      })),
      init: vi.fn(async () => application),
      listen: vi.fn(),
    }
    const bootstrap = vi.fn(async () => application)
    const module = { bootstrap }
    const middleware = createServerModuleMiddleware(async () => module, 'nest')

    await middleware({} as never, {} as ServerResponse, vi.fn())
    await middleware({} as never, {} as ServerResponse, vi.fn())

    expect(bootstrap).toHaveBeenCalledOnce()
    expect(application.init).toHaveBeenCalledOnce()
  })

  test('forwards module loading errors', async () => {
    const error = new Error('load failed')
    const middleware = createServerModuleMiddleware(async () => {
      throw error
    })
    const next = vi.fn()

    await middleware({} as never, {} as ServerResponse, next)

    expect(next).toHaveBeenCalledWith(error)
  })
})
