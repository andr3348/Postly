import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../../shared/decorators.js';
import { GenerateAgentUseCase } from '../application/generate-agent.use-case.js';
import { GenerateTextUseCase } from '../application/generate-text.use-case.js';
import {
  generateAgentSchema,
  generateTextSchema,
  type GenerateAgentDto,
  type GenerateTextDto,
} from './schemas/generation.schema.js';

/**
 * Generación de contenido con IA. Protegida por el guard JWT global.
 * `text` es stateless (el frontend prellena el formulario); `agent` persiste
 * el borrador en el backend y devuelve la publicación creada.
 */
@Controller({ path: 'generations', version: '1' })
export class GenerationController {
  constructor(
    private readonly generateText: GenerateTextUseCase,
    private readonly generateAgent: GenerateAgentUseCase,
  ) {}

  @Post('text')
  @HttpCode(HttpStatus.OK)
  generate(@Body({ schema: generateTextSchema }) body: GenerateTextDto) {
    return this.generateText.execute(body);
  }

  @Post('agent')
  @HttpCode(HttpStatus.CREATED)
  generateWithAgent(
    @Body({ schema: generateAgentSchema }) body: GenerateAgentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.generateAgent.execute({
      requesterId: user.userId,
      ...body,
    });
  }
}
