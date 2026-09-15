import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

describe('UsersController', () => {
  let controller: UsersController;
  const findAll = async () => [
    { id: '1', email: 'alice@prisma.io', username: 'alice', name: 'Alice', createdAt: '2026-01-01' },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: { findAll } }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('delegates to UsersService.findAll', async () => {
    await expect(controller.findAll()).resolves.toEqual(await findAll());
  });
});
