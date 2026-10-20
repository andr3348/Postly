import { Inject, Injectable } from '@nestjs/common';
import { BrandNotFoundError } from '../../../shared/errors.js';
import {
  BRANDS_REPOSITORY,
  type BrandsRepository,
} from '../../brand/domain/ports/brands.repository.js';
import { buildBrandPrompt } from './build-brand-prompt.js';
import { parseGeneratedText } from './parse-generated-text.js';
import type {
  GenerateTextInput,
  GenerateTextResult,
} from '../domain/generated-content.entity.js';
import {
  LLM_TEXT_GENERATOR,
  type LlmTextGenerator,
} from '../domain/ports/llm-text-generator.port.js';

@Injectable()
export class GenerateTextUseCase {
  constructor(
    @Inject(BRANDS_REPOSITORY) private readonly brands: BrandsRepository,
    @Inject(LLM_TEXT_GENERATOR) private readonly generator: LlmTextGenerator,
  ) {}

  async execute(input: GenerateTextInput): Promise<GenerateTextResult> {
    const brand = await this.brands.findById(input.brandId);
    if (brand === null) {
      throw new BrandNotFoundError(input.brandId);
    }

    const prompts = buildBrandPrompt(brand, input);
    const generated = await this.generator.generate({
      systemPrompt: prompts.systemPrompt,
      userPrompt: prompts.userPrompt,
      mode: input.mode,
    });
    const content = parseGeneratedText(
      input.mode,
      generated.text,
      generated.model,
    );

    return {
      model: generated.model,
      tokensUsed: generated.tokensUsed,
      ideas: content.ideas ?? [],
      variants: content.variants ?? [],
    };
  }
}
