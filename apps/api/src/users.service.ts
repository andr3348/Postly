import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.listUsers(10);
  }
}
