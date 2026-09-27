import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../../shared/decorators.js';
import { CreatePublicationUseCase } from '../application/create-publication.use-case.js';
import { UpdateDraftUseCase } from '../application/update-draft.use-case.js';
import { SubmitPublicationUseCase } from '../application/submit-publication.use-case.js';
import { ApprovePublicationUseCase } from '../application/approve-publication.use-case.js';
import { RejectPublicationUseCase } from '../application/reject-publication.use-case.js';
import { GetPublicationUseCase } from '../application/get-publication.use-case.js';
import { ListPublicationsUseCase } from '../application/list-publications.use-case.js';
import { AddTargetUseCase } from '../application/add-target.use-case.js';
import { ListTargetsUseCase } from '../application/list-targets.use-case.js';
import { RemoveTargetUseCase } from '../application/remove-target.use-case.js';
import type { TargetPlatform } from '../domain/target.entity.js';
import {
  approvePublicationSchema,
  type ApprovePublicationDto,
  addTargetSchema,
  type AddTargetDto,
  createPublicationSchema,
  type CreatePublicationDto,
  listPublicationsSchema,
  type ListPublicationsDto,
  targetPlatformSchema,
  updateDraftSchema,
  type UpdateDraftDto,
} from './schemas/publication.schema.js';

/**
 * Controller delgado: valida (Zod), delega al caso de uso y retorna.
 * Todo protegido por el guard global (sin `@Public()`).
 * El `requester` (id + rol) viaja del `@CurrentUser()` al caso de uso,
 * que decide autorización sin conocer HTTP.
 */
@Controller('publications')
export class PublicationsController {
  constructor(
    private readonly createPublication: CreatePublicationUseCase,
    private readonly getPublication: GetPublicationUseCase,
    private readonly listPublications: ListPublicationsUseCase,
    private readonly updateDraftUseCase: UpdateDraftUseCase,
    private readonly submitPublication: SubmitPublicationUseCase,
    private readonly approvePublication: ApprovePublicationUseCase,
    private readonly rejectPublication: RejectPublicationUseCase,
    private readonly addTargetUseCase: AddTargetUseCase,
    private readonly listTargetsUseCase: ListTargetsUseCase,
    private readonly removeTargetUseCase: RemoveTargetUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body({ schema: createPublicationSchema }) body: CreatePublicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.createPublication.execute({ ...body, userId: user.userId });
  }

  @Get()
  list(@Query({ schema: listPublicationsSchema }) query: ListPublicationsDto) {
    return this.listPublications.execute(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.getPublication.execute(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body({ schema: updateDraftSchema }) body: UpdateDraftDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.updateDraftUseCase.execute({
      id,
      requester: { id: user.userId, role: user.role },
      ...body,
    });
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  submit(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.submitPublication.execute({
      id,
      requester: { id: user.userId, role: user.role },
    });
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  approve(
    @Param('id') id: string,
    @Body({ schema: approvePublicationSchema }) body: ApprovePublicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.approvePublication.execute({
      id,
      scheduledAt: new Date(body.scheduledAt),
      requester: { id: user.userId, role: user.role },
    });
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  reject(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.rejectPublication.execute({
      id,
      requester: { id: user.userId, role: user.role },
    });
  }

  @Get(':id/targets')
  listTargets(@Param('id') id: string) {
    return this.listTargetsUseCase.execute(id);
  }

  @Post(':id/targets')
  @HttpCode(HttpStatus.CREATED)
  addTarget(
    @Param('id') id: string,
    @Body({ schema: addTargetSchema }) body: AddTargetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.addTargetUseCase.execute({
      publicationId: id,
      platform: body.platform,
      requester: { id: user.userId, role: user.role },
    });
  }

  @Delete(':id/targets/:platform')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeTarget(
    @Param('id') id: string,
    // El pipe valida contra el schema: si llega aquí, es un valor del enum.
    @Param('platform', { schema: targetPlatformSchema })
    platform: TargetPlatform,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.removeTargetUseCase.execute({
      publicationId: id,
      platform,
      requester: { id: user.userId, role: user.role },
    });
  }
}
