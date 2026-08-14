import * as path from 'node:path'
import * as vite from 'vite'
import { describe, expect, test } from 'vitest'

import { reactRouterServer } from '../plugin.js'

describe('reactRouterServer', () => {
  test('claims a Node server environment and a stable build input', async () => {
    const root = path.resolve('fixture-root')
    const plugin = reactRouterServer()
    const hook = plugin.config
    if (!hook) {
      throw new Error('Expected a config hook')
    }
    const handler = typeof hook === 'function' ? hook : hook.handler
    const config = await handler.call({} as never, { root }, { command: 'serve', mode: 'development' })
    const environment = config?.environments?.ssr
    const bundlerOptions = environment?.build?.['rolldownVersion' in vite ? 'rolldownOptions' : 'rollupOptions']

    expect(plugin.name).toBe('@stormory/react-router-server')
    expect(plugin.enforce).toBe('pre')
    expect(environment?.consumer).toBe('server')
    expect(environment?.build?.ssr).toBe(true)
    expect(bundlerOptions?.input).toEqual({
      'src/main': path.join(root, 'src/main.ts'),
    })
    if ('rolldownVersion' in vite) {
      expect(bundlerOptions?.platform).toBe('node')
    }
  })
})
