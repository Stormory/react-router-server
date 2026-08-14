import type { Request, Response } from 'express'

export async function hello(_req: Request, res: Response) {
  return res.json({
    message: 'hello world',
    date: Date.now(),
  })
}
