import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  CurrentUser,
  Public,
  type AuthenticatedUser,
} from '../../../shared/decorators.js';
import { LoginUseCase } from '../application/login.use-case.js';
import { RefreshUseCase } from '../application/refresh.use-case.js';
import { RegisterUseCase } from '../application/register.use-case.js';
import { loginSchema, type LoginDto } from './schemas/login.schema.js';
import { refreshSchema, type RefreshDto } from './schemas/refresh.schema.js';
import { registerSchema, type RegisterDto } from './schemas/register.schema.js';

/**
 * Controller delgado: valida (Zod), delega al caso de uso y retorna.
 * Los errores de dominio llegan a HTTP vía `DomainExceptionFilter` global.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshUseCase: RefreshUseCase,
  ) {}

  @Public()
  @Post('register')
  register(@Body({ schema: registerSchema }) body: RegisterDto) {
    return this.registerUseCase.execute(body);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body({ schema: loginSchema }) body: LoginDto) {
    return this.loginUseCase.execute(body);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body({ schema: refreshSchema }) body: RefreshDto) {
    return this.refreshUseCase.execute(body);
  }

  /** Sonda autenticada: verifica guard + `@CurrentUser` de punta a punta. */
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
