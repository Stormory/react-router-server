import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import * as vite from 'vite'

import type { NodeMiddleware } from './node-middleware.js'
import type { ReactRouterServerModule, ReactRouterServerPluginOptions } from './types.js'

import { createServerModuleMiddleware } from './server-middleware.js'

const PLUGIN_NAME = '@stormory/react-router-server'

/** Make a server application the real entry of a Vite server environment. */
export function reactRouterServer(options: ReactRouterServerPluginOptions = {}): vite.Plugin {
  const environmentName = options.environment ?? 'ssr'
  const entry = options.entry ?? 'src/main.ts'
  const entryName = options.entryName ?? 'src/main'
  const framework = options.framework ?? 'express'
  const entryFileName = 'index.js'
  let absoluteEntry = ''
  let builtEntry = ''

  return {
    name: PLUGIN_NAME,
    enforce: 'pre',
    sharedDuringBuild: true,

    config(userConfig) {
      const root = path.resolve(userConfig.root ?? process.cwd())
      absoluteEntry = path.resolve(root, entry)
      const outDir =
        userConfig.environments?.[environmentName]?.build?.outDir ??
        path.join(userConfig.build?.outDir ?? 'dist', environmentName)
      const bundlerOptions = {
        input: { [entryName]: absoluteEntry },
        output: { entryFileNames: entryFileName },
        preserveEntrySignatures: 'exports-only' as const,
        ...('rolldownVersion' in vite ? { platform: 'node' as const } : {}),
      }
      const inputOptions =
        'rolldownVersion' in vite ? { rolldownOptions: bundlerOptions } : { rollupOptions: bundlerOptions }

      return {
        appType: 'custom',
        environments: {
          [environmentName]: {
            consumer: 'server',
            dev: {
              createEnvironment(name, config) {
                return vite.createRunnableDevEnvironment(name, config)
              },
            },
            build: {
              copyPublicDir: false,
              emitAssets: true,
              outDir,
              ssr: true,
              ...inputOptions,
            },
          },
        },
      }
    },

    configResolved(config) {
      const environment = config.environments[environmentName]
      const outDir = environment?.build.outDir
      if (!outDir) {
        throw new Error(`[${PLUGIN_NAME}] Vite environment "${environmentName}" has no build.outDir.`)
      }
      assertEntryFileName(environment.build, entryFileName)
      builtEntry = path.resolve(config.root, outDir, entryFileName)
    },

    configureServer(server) {
      return () => {
        server.middlewares.use(
          asConnectMiddleware(
            createServerModuleMiddleware(async () => {
              const environment = server.environments[environmentName]
              if (!environment || !vite.isRunnableDevEnvironment(environment)) {
                throw new Error(`[${PLUGIN_NAME}] Vite environment "${environmentName}" is not runnable.`)
              }

              return environment.runner.import<ReactRouterServerModule>(absoluteEntry)
            }, framework),
          ),
        )
      }
    },

    configurePreviewServer(server) {
      let modulePromise: Promise<ReactRouterServerModule> | undefined
      return () => {
        server.middlewares.use(
          asConnectMiddleware(
            createServerModuleMiddleware(() => {
              modulePromise ??= import(
                /* @vite-ignore */ pathToFileUrlWithVersion(builtEntry)
              ) as Promise<ReactRouterServerModule>
              return modulePromise
            }, framework),
          ),
        )
      }
    },
  }
}

function asConnectMiddleware(middleware: NodeMiddleware): (...parameters: Parameters<NodeMiddleware>) => void {
  return (...parameters) => {
    void middleware(...parameters)
  }
}

function pathToFileUrlWithVersion(filePath: string): string {
  const url = pathToFileURL(filePath)
  url.searchParams.set('v', String(Date.now()))
  return url.href
}

function assertEntryFileName(build: vite.ResolvedBuildEnvironmentOptions, expected: string): void {
  const bundlerOptions = ('rolldownVersion' in vite ? build.rolldownOptions : build.rollupOptions) as {
    output?: { entryFileNames?: unknown } | { entryFileNames?: unknown }[]
  }
  const outputs = Array.isArray(bundlerOptions.output) ? bundlerOptions.output : [bundlerOptions.output]
  const entryFileNames = outputs.map((output) => output?.entryFileNames).filter((value) => value !== undefined)

  if (entryFileNames.length !== 1 || entryFileNames[0] !== expected) {
    throw new Error(
      `[${PLUGIN_NAME}] The "${expected}" server output is required. Set serverBuildFile: "${expected}" in react-router.config.ts.`,
    )
  }
}
