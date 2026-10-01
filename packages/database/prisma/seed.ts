import { prisma } from '../src/index.js';
// Enums runtime solo vía namespace `$Enums` (el cliente v7 no los re-exporta planos).
import { $Enums } from '../src/generated/prisma/client.js';
import * as argon2 from 'argon2';

const { MediaType, Platform, PlatformStatus, PublicationStatus } = $Enums;

/** Env requerida con mensaje accionable (el seed no adivina credenciales). */
function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(
      `[seed] Missing ${name}. Define it in packages/database/.env (see .env.example).`,
    );
  }
  return value;
}

async function main() {
  await prisma.targetMetric.deleteMany();
  await prisma.publicationTarget.deleteMany();
  await prisma.publication.deleteMany();
  await prisma.connectedAccount.deleteMany();
  await prisma.user.deleteMany();
  await prisma.brand.deleteMany();

  // Admin bootstrap: sin esto ningún ADMIN existiría (register crea MARKETING
  // y este era el único usuario). Hash argon2id real = login funcional en dev.
  const admin = await prisma.user.create({
    data: {
      email: requiredEnv('SEED_ADMIN_EMAIL'),
      name: 'Administrador',
      role: 'ADMIN',
      passwordHash: await argon2.hash(requiredEnv('SEED_ADMIN_PASSWORD'), {
        type: argon2.argon2id,
      }),
    },
  });

  const user = await prisma.user.create({
    data: {
      email: 'marketing@almaquinta.com',
      name: 'Equipo Marketing',
      passwordHash: await argon2.hash(requiredEnv('SEED_MARKETING_PASSWORD'), {
        type: argon2.argon2id,
      }),
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
  // El admin la "aprobó": ejercita la auditoría human-in-the-loop.
  await prisma.publication.create({
    data: {
      brandId: brand.id,
      userId: user.id,
      approvedById: admin.id,
      approvedAt: new Date(),
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

  // DRAFT = ya generado por IA y editable (el prompt pre-generación vive
  // en el frontend, no en BD). Muestra el estado editable del dashboard.
  await prisma.publication.create({
    data: {
      brandId: brand.id,
      userId: user.id,
      originalPrompt: 'Post sobre los beneficios del café arequipeño para LinkedIn',
      copy: 'BORRADOR: El café arequipeño combina tradición e innovación en cada taza. ¿Ya probaste nuestra nueva línea? #Arequipa',
      mediaUrl: 'https://example.com/drafts/cafe-arequipeno.jpg',
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
