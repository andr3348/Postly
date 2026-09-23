import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';
import { Public } from './shared/decorators.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** Raíz pública (saludo/health): el guard global la omite vía `@Public()`. */
  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
