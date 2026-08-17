import type { Handler } from 'hono'

import { createRequestHandler, RouterContextProvider } from 'react-router'

const handleRequest = createRequestHandler(() => import('virtual:react-router/server-build'), import.meta.env.MODE)

export const dashboard: Handler = (context) => {
  return handleRequest(context.req.raw, new RouterContextProvider())
}
