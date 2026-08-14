import { Controller, Get, Next, Req, Res } from '@nestjs/common';
import { createWebRequest, sendWebResponse } from '@stormory/react-router-server';
import { createRequestHandler, RouterContextProvider } from 'react-router';

const handleRequest = createRequestHandler(() => import('virtual:react-router/server-build'), import.meta.env.MODE)

@Controller()
export class DashboardController {
  @Get('/*')
  async index(@Req() req: any, @Res() res: any, @Next() next: any) {
    try {
      const response = await handleRequest(createWebRequest(req, res), new RouterContextProvider())
      await sendWebResponse(res, response, req.method === 'HEAD')
    } catch (error) {
      next(error)
    }
  }
}