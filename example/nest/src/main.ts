import express from 'express'
import path from 'node:path'
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

export async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const clientDirectory = path.resolve('build/client')

  // Static assets
  app.use(
    '/assets',
    express.static(path.join(clientDirectory, 'assets'), {
      immutable: true,
      maxAge: '1y',
    }),
  )
  app.use(express.static(clientDirectory))

  return app
}
