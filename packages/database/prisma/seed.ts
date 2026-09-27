import { prisma } from '../src/index.js';
// Enums runtime solo vía namespace `$Enums` (el cliente v7 no los re-exporta planos).
import { $Enums } from '../src/generated/prisma/client.js';

const { MediaType, Platform, PlatformStatus, PublicationStatus } = $Enums;

async function main() {
  await prisma.targetMetric.deleteMany();
  await prisma.publicationTarget.deleteMany();
  await prisma.publication.deleteMany();
  await prisma.connectedAccount.deleteMany();
  await prisma.user.deleteMany();
  await prisma.brand.deleteMany();

  const user = await prisma.user.create({
    data: {
      email: 'marketing@almaquinta.com',
      name: 'Equipo Marketing',
      // Solo seed local. En real: hash bcrypt/argon2 generado en registro.
      passwordHash: 'seed-local-no-usar-en-produccion',
    },
  });

  const brand = await prisma.brand.create({
    data: {
      name: 'Alma Quinta',
      aiTone: 'Profesional y persuasivo',
      aiBrandVoice: 'Marca arequipeña cercana que combina tradición con innovación',
      aiTargetAudience: 'Negocios B2B del sur del Perú',
      defaultHashtags: ['#Marketing', '#Arequipa'],
    },
  });

  // Publicación completa ya publicada (alimenta Analytics del dashboard).
  await prisma.publication.create({
    data: {
      brandId: brand.id,
      userId: user.id,
      originalPrompt: 'Campaña de ciberseguridad corporativa para B2B',
      copy: 'Protege la infraestructura de tu empresa contra ataques modernos. Conoce nuestras soluciones integrales.',
      mediaUrl:
        'https://www.esic.edu/sites/default/files/2024-07/que%20es%20la%20ciberseguridad.jpg',
      mediaType: MediaType.IMAGE,
      status: PublicationStatus.PUBLISHED,
      targets: {
        create: [
          {
            platform: Platform.LINKEDIN,
            status: PlatformStatus.SUCCESS,
            externalPostId: 'urn:li:share:99887766',
            externalPostUrl: 'https://linkedin.com',
            metrics: {
              create: [
                { impressions: 1420, likes: 85, comments: 12, shares: 18, clicks: 45 },
              ],
            },
          },
          {
            platform: Platform.FACEBOOK,
            status: PlatformStatus.SUCCESS,
            externalPostId: 'fb_post_112233',
            externalPostUrl: 'https://facebook.com',
            metrics: {
              create: [
                { impressions: 2300, likes: 110, comments: 8, shares: 5, clicks: 20 },
              ],
            },
          },
        ],
      },
    },
  });

  // DRAFT prompt-primero: existe ANTES de generar copy/media (flujo real del
  // dashboard). Prueba viva de que `copy`/`mediaUrl` son opcionales.
  await prisma.publication.create({
    data: {
      brandId: brand.id,
      userId: user.id,
      originalPrompt: 'Post sobre los beneficios del café arequipeño para LinkedIn',
      status: PublicationStatus.DRAFT,
    },
  });

  console.log('Base de datos poblada con éxito.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
