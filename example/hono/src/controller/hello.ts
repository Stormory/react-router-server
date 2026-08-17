import type { Handler } from 'hono'

export const hello: Handler = (context) => {
  return context.json({
    message: 'hello world',
    date: Date.now(),
  })
}
