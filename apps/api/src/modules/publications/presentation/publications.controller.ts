import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../../../shared/decorators.js';
import { CreatePublicationUseCase } from '../application/create-publication.use-case.js';
import {
  ApprovePublicationUseCase,
  RejectPublicationUseCase,
  SubmitPublicationUseCase,
  UpdateDraftUseCase,
} from '../application/flow-publication.use-case.js';
import {
  GetPublicationUseCase,
  ListPublicationsUseCase,
} from '../application/query-publication.use-case.js';
import {
  approvePublicationSchema,
  type ApprovePublicationDto,
  createPublicationSchema,
  type CreatePublicationDto,
  listPublicationsSchema,
  type ListPublicationsDto,
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
}
