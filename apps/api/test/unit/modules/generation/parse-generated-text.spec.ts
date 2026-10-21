import { AiGenerationInvalidResponseError } from '../../../../src/shared/errors.js';
import { parseGeneratedText } from '../../../../src/modules/generation/application/parse-generated-text.js';

describe('parseGeneratedText', () => {
  it('parsea ideas aunque vengan envueltas en un bloque markdown', () => {
    const text = [
      '```json',
      '{"ideas":[{"title":"Título","angle":"Ángulo","hook":"Hook","whyItWorks":"Funciona","suggestedFormat":"REEL"}]}',
      '```',
    ].join('\n');

    const result = parseGeneratedText('IDEAS', text);

    expect(result.ideas).toHaveLength(1);
    expect(result.ideas?.[0]).toMatchObject({
      title: 'Título',
      suggestedFormat: 'REEL',
    });
  });

  it('parsea variantes y aplica defaults a campos opcionales', () => {
    const result = parseGeneratedText(
      'COPY',
      JSON.stringify({
        variants: [
          {
            title: 'Titular',
            copy: 'Copy listo',
            hashtags: ['#Marketing'],
            cta: 'Agenda tu llamada',
            mediaPrompt: 'Imagen de una oficina',
            altText: 'Oficina moderna',
          },
        ],
      }),
    );

    expect(result.variants).toHaveLength(1);
    expect(result.variants?.[0]).toMatchObject({
      title: 'Titular',
      copy: 'Copy listo',
      cta: 'Agenda tu llamada',
    });
  });

  it('rechaza JSON inválido con un error reintentable', () => {
    expect(() =>
      parseGeneratedText('COPY', 'esto no es json', 'gemini-3.8-flash'),
    ).toThrow(AiGenerationInvalidResponseError);

    try {
      parseGeneratedText('COPY', 'esto no es json', 'gemini-3.8-flash');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'GEMINI_INVALID_RESPONSE',
        retryable: true,
        model: 'gemini-3.8-flash',
      });
      return;
    }
    throw new Error('Se esperaba un error de respuesta inválida');
  });

  it('rechaza una respuesta sin variantes', () => {
    expect(() => parseGeneratedText('COPY', '{"ideas":[]}')).toThrow(
      AiGenerationInvalidResponseError,
    );
  });
});
