import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
// Feature modules (e.g. UsersModule with its Prisma repository) are added
// here once their models exist in `packages/database/prisma/schema.prisma`.
import { PrismaModule } from './shared/prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
