import { Module } from '@nestjs/common';
import { BrandModule } from '../brand/brand.module.js';
import { GenerateTextUseCase } from './application/generate-text.use-case.js';
import { LLM_TEXT_GENERATOR } from './domain/ports/llm-text-generator.port.js';
import { GeminiTextGenerator } from './infrastructure/gemini-text.generator.js';
import { GenerationController } from './presentation/generation.controller.js';

/**
 * Generación de texto con IA. Depende de BrandModule solo para leer el
 * contexto de marca; no escribe en la base de datos.
 */
@Module({
  imports: [BrandModule],
  controllers: [GenerationController],
  providers: [
    GenerateTextUseCase,
    { provide: LLM_TEXT_GENERATOR, useClass: GeminiTextGenerator },
  ],
})
export class GenerationModule {}
