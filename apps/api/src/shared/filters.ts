import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  UnauthorizedException,
} from '@nestjs/common';
import {
  EmailAlreadyTakenError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
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
)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: Error, _host: ArgumentsHost): void {
    if (exception instanceof EmailAlreadyTakenError) {
      throw new ConflictException(exception.message);
    }
    throw new UnauthorizedException(exception.message);
  }
}
