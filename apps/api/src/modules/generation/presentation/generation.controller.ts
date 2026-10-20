import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { GenerateTextUseCase } from '../application/generate-text.use-case.js';
import {
  generateTextSchema,
  type GenerateTextDto,
} from './schemas/generation.schema.js';

/**
 * Superficie humana del asistente de texto. Protegida por el guard JWT global.
 * No persiste nada: el frontend usa la respuesta para prellenar el formulario.
 */
@Controller({ path: 'generations', version: '1' })
export class GenerationController {
  constructor(private readonly generateText: GenerateTextUseCase) {}

  @Post('text')
  @HttpCode(HttpStatus.OK)
  generate(@Body({ schema: generateTextSchema }) body: GenerateTextDto) {
    return this.generateText.execute(body);
  }
}
