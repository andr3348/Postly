import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  EmailAlreadyTakenError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  BrandNotFoundError,
} from './errors.js';

/**
 * Traduce errores de dominio a HTTP en un solo lugar.
 * Gracias a esto los controllers son delgados: sin try-catch,
 * solo validan (schemas), delegan al caso de uso y retornan.
 */
@Catch(
  EmailAlreadyTakenError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  BrandNotFoundError,
)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: Error, _host: ArgumentsHost): void {
    if (exception instanceof EmailAlreadyTakenError) {
      throw new ConflictException(exception.message);
    }
    if (exception instanceof BrandNotFoundError) {
      throw new NotFoundException(exception.message);
    }
    throw new UnauthorizedException(exception.message);
  }
}
