# @stormory/react-router-server

Use an Express, NestJS, Fastify, Koa, or Hono application as the server entry for a
React Router Framework Mode app powered by Vite.

## Install

```sh
pnpm add @stormory/react-router-server express
pnpm add -D @react-router/dev vite
```

Requires Node.js 22.12+, Vite 6.1–8, and React Router with SSR enabled. Replace
Express with your chosen server framework when needed.

## Setup

### Vite

Place `reactRouterServer()` before the React Router plugin:

```ts
// vite.config.ts
import { reactRouter } from '@react-router/dev/vite'
import { reactRouterServer } from '@stormory/react-router-server'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [reactRouterServer({ framework: 'express' }), reactRouter()],
})
```

```ts
// react-router.config.ts
import type { Config } from '@react-router/dev/config'

export default { ssr: true } satisfies Config
```

### Server entry

The default entry is `src/main.ts`. Export `bootstrap()` and return the original
framework application.

```ts
import type { NextFunction, Request, Response } from 'express'

import express from 'express'
import path from 'node:path'
import { createWebRequest, sendWebResponse } from '@stormory/react-router-server'
import { createRequestHandler, RouterContextProvider } from 'react-router'

const handleRequest = createRequestHandler(() => import('virtual:react-router/server-build'), import.meta.env.MODE)

async function dashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const response = await handleRequest(createWebRequest(req, res), new RouterContextProvider())
    await sendWebResponse(res, response, req.method === 'HEAD')
  } catch (error) {
    next(error)
  }
}

export function bootstrap() {
  const app = express()

  app.use(express.static(path.resolve('build/client')))
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))
  app.use(dashboard)

  return app
}
```

Register static files and API routes before the React Router fallback.

## Frameworks

Use the same `framework` value in Vite and the production CLI.

| Framework | Vite request handling                  | Production startup           | Shutdown      |
| --------- | -------------------------------------- | ---------------------------- | ------------- |
| Express   | Connect middleware                     | `app.listen(port, host)`     | Native server |
| NestJS    | Express or Fastify HTTP adapter        | `app.listen(port, host)`     | `app.close()` |
| Fastify   | `app.ready()` and `app.routing()`      | `app.listen({ port, host })` | `app.close()` |
| Hono      | Fetch handler from `app.fetch()`       | Managed Node server          | Native server |
| Koa       | Request listener from `app.callback()` | `app.listen(port, host)`     | Native server |

Nest entries return the Nest application itself. The plugin initializes and
adapts it internally; do not return `app.getHttpAdapter().getInstance()`.

```ts
reactRouterServer({ framework: 'nest' })
```

```sh
react-router-server build/server/index.js --framework=nest
```

## Run

```json
{
  "scripts": {
    "dev": "react-router dev",
    "build": "react-router build",
    "start": "react-router-server build/server/index.js"
  }
}
```

```sh
pnpm dev
pnpm build
pnpm start
```

CLI syntax:

```sh
react-router-server <server-entry> \
  --framework=express \
  --host=localhost \
  --port=3000
```

The CLI calls the returned application's `listen()` method. It does not serve
`build/client` automatically.

## Plugin options

| Option        | Default       | Description                                    |
| ------------- | ------------- | ---------------------------------------------- |
| `framework`   | `express`     | `express`, `nest`, `fastify`, `hono`, or `koa` |
| `entry`       | `src/main.ts` | Server entry relative to the Vite root         |
| `entryName`   | `src/main`    | Bundler entry name                             |
| `environment` | `ssr`         | Vite server environment                        |

The server build must emit `index.js`, React Router's default
`serverBuildFile`.

## API

- `reactRouterServer(options?)` creates the Vite plugin.
- `createWebRequest(request, response?)` converts a Node request to a Fetch API
  `Request`.
- `sendWebResponse(response, webResponse, headOnly?)` streams a Fetch API
  `Response` to Node.

## License

MIT
