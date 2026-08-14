import { AppService } from '@/service/app.service';
import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('/api/hello')
  index() {
    return this.appService.getHello();
  }
}
