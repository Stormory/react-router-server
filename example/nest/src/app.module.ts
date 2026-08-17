import { Module } from '@nestjs/common'

import { AppController } from './controller/app.controller'
import { DashboardController } from './controller/dashboard.controller'
import { AppService } from './service/app.service'

@Module({
  imports: [],
  controllers: [AppController, DashboardController],
  providers: [AppService],
})
export class AppModule {}
