export interface ReactRouterServerModule {
  bootstrap?: unknown
}

export type ServerFramework = 'express' | 'fastify' | 'hono' | 'koa' | 'nest'

export interface ReactRouterServerPluginOptions {
  /** Server application module, relative to Vite's resolved root. */
  entry?: string

  /** Vite server environment to own. React Router expects `ssr`. */
  environment?: string

  /** Stable entry name used by the multi-environment build. */
  entryName?: string

  /** Framework returned by the entry module's bootstrap function. */
  framework?: ServerFramework
}
