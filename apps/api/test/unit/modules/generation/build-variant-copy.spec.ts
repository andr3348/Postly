import { buildVariantCopy } from '../../../../src/modules/generation/application/build-variant-copy.js';

describe('buildVariantCopy', () => {
  it('une copy y hashtags normalizados con una línea en blanco', () => {
    const copy = buildVariantCopy({
      title: 'T',
      copy: '  Texto principal  ',
      hashtags: ['Marketing', '#Pymes'],
      cta: 'CTA',
      mediaPrompt: 'Media',
      altText: 'Alt',
    });

    expect(copy).toBe('Texto principal\n\n#Marketing #Pymes');
  });

  it('omite la sección de hashtags cuando no hay', () => {
    const copy = buildVariantCopy({
      title: 'T',
      copy: 'Texto principal',
      hashtags: ['   ', ''],
      cta: 'CTA',
      mediaPrompt: 'Media',
      altText: 'Alt',
    });

    expect(copy).toBe('Texto principal');
  });
});
