import type { NextFunction, Request, Response } from 'express'

import { createWebRequest, sendWebResponse } from '@stormory/react-router-server'
import { createRequestHandler, RouterContextProvider } from 'react-router'

const handleRequest = createRequestHandler(() => import('virtual:react-router/server-build'), import.meta.env.MODE)

export async function dashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const response = await handleRequest(createWebRequest(req, res), new RouterContextProvider())
    await sendWebResponse(res, response, req.method === 'HEAD')
  } catch (error) {
    next(error)
  }
}
