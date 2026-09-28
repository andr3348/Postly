import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  BrandNotFoundError,
  EmailAlreadyTakenError,
  ForbiddenError,
  InvalidCredentialsError,
  InvalidPublicationTransitionError,
  InvalidRefreshTokenError,
  PublicationNotFoundError,
  PublicationTargetAlreadyAttachedError,
  PublicationTargetNotFoundError,
  PublicationWithoutTargetsError,
  MissingConnectedAccountError,
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
  PublicationNotFoundError,
  PublicationTargetNotFoundError,
  PublicationTargetAlreadyAttachedError,
  PublicationWithoutTargetsError,
  InvalidPublicationTransitionError,
  ForbiddenError,
  MissingConnectedAccountError,
)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: Error, _host: ArgumentsHost): void {
    if (exception instanceof EmailAlreadyTakenError) {
      throw new ConflictException(exception.message);
    }
    if (exception instanceof PublicationTargetAlreadyAttachedError) {
      throw new ConflictException(exception.message);
    }
    if (
      exception instanceof BrandNotFoundError ||
      exception instanceof PublicationNotFoundError ||
      exception instanceof PublicationTargetNotFoundError
    ) {
      throw new NotFoundException(exception.message);
    }
    if (
      exception instanceof InvalidPublicationTransitionError ||
      exception instanceof PublicationWithoutTargetsError ||
      exception instanceof MissingConnectedAccountError
    ) {
      throw new BadRequestException(exception.message);
    }
    if (exception instanceof ForbiddenError) {
      throw new ForbiddenException(exception.message);
    }
    throw new UnauthorizedException(exception.message);
  }
}
