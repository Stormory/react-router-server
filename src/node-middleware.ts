import type * as http from 'node:http'

import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

export type NodeRequest = http.IncomingMessage & { originalUrl?: string }
export type NextFunction = (error?: unknown) => void
export type NodeMiddleware = (
  request: NodeRequest,
  response: http.ServerResponse,
  next: NextFunction,
) => void | Promise<void>

/** Convert an Express/Node request into a streaming Fetch Request. */
export function createWebRequest(request: NodeRequest, response?: http.ServerResponse): Request {
  const controller = new AbortController()
  const abort = () => controller.abort()

  if (request.destroyed && !request.complete) {
    controller.abort()
  } else {
    request.once('close', () => {
      if (!request.complete) {
        abort()
      }
    })
    response?.once('close', () => {
      if (!response.writableEnded) {
        abort()
      }
    })
  }

  const protocol = getRequestProtocol(request)
  const host =
    firstForwardedHeader(request.headers['x-forwarded-host']) ??
    firstHeader(request.headers.host ?? request.headers[':authority'])
  const pathname = request.originalUrl ?? request.url ?? '/'
  const url = new URL(pathname, `${protocol}//${host ?? 'localhost'}`)
  const headers = new Headers()

  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    const name = request.rawHeaders[index]
    const value = request.rawHeaders[index + 1]
    if (name !== undefined && value !== undefined && !name.startsWith(':')) {
      headers.append(name, value)
    }
  }

  const method = request.method ?? 'GET'
  const hasBody = method !== 'GET' && method !== 'HEAD'
  const init: RequestInit & { duplex?: 'half' } = {
    method,
    headers,
    signal: controller.signal,
  }

  if (hasBody) {
    init.body = Readable.toWeb(request) as unknown as BodyInit
    init.duplex = 'half'
  }

  return new Request(url, init)
}

/** Send a streaming Fetch Response through an Express/Node response. */
export async function sendWebResponse(
  response: http.ServerResponse,
  webResponse: Response,
  headOnly = false,
): Promise<void> {
  response.statusCode = webResponse.status
  if (webResponse.statusText && response.req?.httpVersionMajor !== 2) {
    response.statusMessage = webResponse.statusText
  }

  const setCookies = getSetCookieValues(webResponse.headers)
  webResponse.headers.forEach((value, name) => {
    if (name === 'set-cookie') {
      return
    }
    if (response.req?.httpVersionMajor === 2 && name === 'transfer-encoding') {
      return
    }
    response.setHeader(name, value)
  })

  if (setCookies.length > 0) {
    response.setHeader('set-cookie', setCookies)
  }

  if (headOnly || webResponse.body === null) {
    if (headOnly && webResponse.body !== null) {
      await webResponse.body.cancel()
    }
    response.end()
    return
  }

  await pipeline(Readable.from(webResponse.body as unknown as AsyncIterable<Uint8Array>), response)
}

function getRequestProtocol(request: http.IncomingMessage): 'http:' | 'https:' {
  const forwarded = firstHeader(request.headers['x-forwarded-proto'])?.split(',')[0]?.trim().toLowerCase()

  if (forwarded === 'http' || forwarded === 'https') {
    return `${forwarded}:`
  }

  return (request.socket as { encrypted?: boolean }).encrypted ? 'https:' : 'http:'
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function firstForwardedHeader(value: string | string[] | undefined): string | undefined {
  return firstHeader(value)?.split(',', 1)[0]?.trim() || undefined
}

function getSetCookieValues(headers: Headers): string[] {
  const extendedHeaders = headers as Headers & {
    getSetCookie?: () => string[]
    raw?: () => Record<string, string[]>
  }
  const values = extendedHeaders.getSetCookie?.call(headers)
  if (values && values.length > 0) {
    return values
  }

  const rawValues = extendedHeaders.raw?.call(headers)['set-cookie']
  if (rawValues && rawValues.length > 0) {
    return rawValues
  }

  const combined = headers.get('set-cookie')
  return combined === null ? [] : splitSetCookieHeader(combined)
}

function splitSetCookieHeader(value: string): string[] {
  const cookies: string[] = []
  let start = 0
  let inQuotes = false

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]
    if (character === '"' && value[index - 1] !== '\\') {
      inQuotes = !inQuotes
      continue
    }
    if (character !== ',' || inQuotes) {
      continue
    }

    let next = index + 1
    while (value[next] === ' ' || value[next] === '\t') {
      next += 1
    }
    const equals = value.indexOf('=', next)
    const semicolon = value.indexOf(';', next)
    const comma = value.indexOf(',', next)
    if (equals !== -1 && (semicolon === -1 || equals < semicolon) && (comma === -1 || equals < comma)) {
      cookies.push(value.slice(start, index).trim())
      start = next
      index = next - 1
    }
  }

  cookies.push(value.slice(start).trim())
  return cookies.filter(Boolean)
}
