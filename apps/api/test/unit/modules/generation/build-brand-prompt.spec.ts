import { buildBrandPrompt } from '../../../../src/modules/generation/application/build-brand-prompt.js';
import { BASE_BRAND } from './test-stubs.js';

describe('buildBrandPrompt', () => {
  it('incluye el contexto de marca y las ideas que no debe repetir', () => {
    const prompts = buildBrandPrompt(BASE_BRAND, {
      brandId: BASE_BRAND.id,
      mode: 'IDEAS',
      prompt: 'Curso de marketing para pymes',
      excludeIdeas: ['Idea anterior'],
    });

    expect(prompts.systemPrompt).toContain('Alma Quinta');
    expect(prompts.systemPrompt).toContain('Profesional y cercano');
    expect(prompts.systemPrompt).toContain('Pymes de Arequipa');
    expect(prompts.systemPrompt).toContain('#Marketing');
    expect(prompts.systemPrompt).toContain('"ideas"');
    expect(prompts.userPrompt).toContain('Idea anterior');
    expect(prompts.userPrompt).toContain('Curso de marketing para pymes');
  });

  it('escribe las instrucciones en inglés y exige la salida en español', () => {
    const prompts = buildBrandPrompt(BASE_BRAND, {
      brandId: BASE_BRAND.id,
      mode: 'COPY',
      prompt: 'Lanzamiento de un curso',
    });

    expect(prompts.systemPrompt).toContain(
      'You are a senior social media marketing copywriter.',
    );
    expect(prompts.systemPrompt).toContain(
      'Write every generated user-facing value in neutral Latin American Spanish',
    );
    expect(prompts.systemPrompt).toContain(
      'Write all variant fields in neutral Latin American Spanish.',
    );
    expect(prompts.systemPrompt).toContain('do not translate the keys');
    expect(prompts.userPrompt).toContain(
      'Output language: neutral Latin American Spanish.',
    );
    expect(prompts.systemPrompt).not.toContain('Eres un redactor senior');
  });

  it('adapta el mediaPrompt al formato Reel', () => {
    const prompts = buildBrandPrompt(BASE_BRAND, {
      brandId: BASE_BRAND.id,
      mode: 'COPY',
      prompt: 'Lanzamiento de un curso',
      platform: 'INSTAGRAM',
      format: 'REEL',
      mediaType: 'VIDEO',
    });

    expect(prompts.userPrompt).toContain('INSTAGRAM');
    expect(prompts.userPrompt).toContain('REEL');
    expect(prompts.userPrompt).toContain('9:16');
    expect(prompts.systemPrompt).toContain('"variants"');
  });

  it('incluye el copy actual y el feedback para el modo IMPROVE', () => {
    const prompts = buildBrandPrompt(BASE_BRAND, {
      brandId: BASE_BRAND.id,
      mode: 'IMPROVE',
      currentCopy: 'Texto original',
      feedback: 'Hazlo más corto',
    });

    expect(prompts.userPrompt).toContain('Texto original');
    expect(prompts.userPrompt).toContain('Hazlo más corto');
    expect(prompts.userPrompt).toContain('Current copy to improve:');
    expect(prompts.userPrompt).toContain('Additional user feedback:');
    expect(prompts.systemPrompt).toContain(
      'Improve the current copy by applying the user feedback while preserving the original intent.',
    );
  });
});
