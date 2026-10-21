import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrandModule } from '../brand/brand.module.js';
import { PublicationsModule } from '../publications/publications.module.js';
import { GenerateAgentUseCase } from './application/generate-agent.use-case.js';
import { GenerateTextUseCase } from './application/generate-text.use-case.js';
import { LLM_TEXT_GENERATOR } from './domain/ports/llm-text-generator.port.js';
import { MEDIA_GENERATOR } from './domain/ports/media-generator.port.js';
import { MEDIA_STORAGE } from './domain/ports/media-storage.port.js';
import { FalMediaGenerator } from './infrastructure/fal-media.generator.js';
import { GeminiTextGenerator } from './infrastructure/gemini-text.generator.js';
import { R2MediaStorage } from './infrastructure/r2-media.storage.js';
import { GenerationController } from './presentation/generation.controller.js';

/**
 * Generación de contenido con IA: texto (stateless) y modo agente (texto →
 * media en fal.ai → copia a R2 → borrador persistido). Depende de
 * PublicationsModule para reusar el alta de borradores.
 *
 * Los adaptadores de media se arman con `useFactory` para que sus hooks de
 * test (fetch/cliente S3/sleep) no entren en los metadatos de DI.
 */
@Module({
  imports: [BrandModule, PublicationsModule],
  controllers: [GenerationController],
  providers: [
    GenerateTextUseCase,
    GenerateAgentUseCase,
    { provide: LLM_TEXT_GENERATOR, useClass: GeminiTextGenerator },
    {
      provide: MEDIA_GENERATOR,
      useFactory: (config: ConfigService) => new FalMediaGenerator(config),
      inject: [ConfigService],
    },
    {
      provide: MEDIA_STORAGE,
      useFactory: (config: ConfigService) => new R2MediaStorage(config),
      inject: [ConfigService],
    },
  ],
})
export class GenerationModule {}
