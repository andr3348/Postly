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
import type { Response } from 'express';
import {
  AiGenerationError,
  BrandNotFoundError,
  ConnectedAccountNotFoundError,
  EmailAlreadyTakenError,
  ForbiddenError,
  InvalidAccountCredentialsError,
  InvalidCredentialsError,
  InvalidPublicationTransitionError,
  InvalidRefreshTokenError,
  InvalidTargetFormatError,
  PublicationNotFoundError,
  PublicationTargetAlreadyAttachedError,
  PublicationTargetNotFoundError,
  PublicationWithoutTargetsError,
  MissingConnectedAccountError,
  TargetNotPublishedError,
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
  ConnectedAccountNotFoundError,
  PublicationNotFoundError,
  PublicationTargetNotFoundError,
  PublicationTargetAlreadyAttachedError,
  PublicationWithoutTargetsError,
  TargetNotPublishedError,
  InvalidPublicationTransitionError,
  InvalidTargetFormatError,
  ForbiddenError,
  MissingConnectedAccountError,
  InvalidAccountCredentialsError,
  AiGenerationError,
)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    if (exception instanceof AiGenerationError) {
      const response = host.switchToHttp().getResponse<Response>();
      response.status(exception.httpStatus).json({
        statusCode: exception.httpStatus,
        code: exception.code,
        provider: exception.provider,
        ...(exception.model !== null ? { model: exception.model } : {}),
        message: exception.message,
        retryable: exception.retryable,
      });
      return;
    }
    if (exception instanceof EmailAlreadyTakenError) {
      throw new ConflictException(exception.message);
    }
    if (exception instanceof PublicationTargetAlreadyAttachedError) {
      throw new ConflictException(exception.message);
    }
    if (
      exception instanceof BrandNotFoundError ||
      exception instanceof ConnectedAccountNotFoundError ||
      exception instanceof PublicationNotFoundError ||
      exception instanceof PublicationTargetNotFoundError
    ) {
      throw new NotFoundException(exception.message);
    }
    if (
      exception instanceof InvalidPublicationTransitionError ||
      exception instanceof InvalidTargetFormatError ||
      exception instanceof PublicationWithoutTargetsError ||
      exception instanceof TargetNotPublishedError ||
      exception instanceof MissingConnectedAccountError ||
      exception instanceof InvalidAccountCredentialsError
    ) {
      throw new BadRequestException(exception.message);
    }
    if (exception instanceof ForbiddenError) {
      throw new ForbiddenException(exception.message);
    }
    throw new UnauthorizedException(exception.message);
  }
}
