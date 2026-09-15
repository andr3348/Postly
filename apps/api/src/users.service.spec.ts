import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let service: UsersService;
  const users = [
    { id: '1', email: 'alice@prisma.io', username: 'alice', name: 'Alice', createdAt: '2026-01-01' },
  ];
  const listUsers = async () => users;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: { listUsers } }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('delegates to PrismaService.listUsers', async () => {
    await expect(service.findAll()).resolves.toEqual(users);
  });
});
