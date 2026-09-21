import { prisma } from '../src/index.js';
import { Platform, PlatformStatus, PublicationStatus, MediaType } from '../src/generated/prisma/client.js';

async function main() {
  await prisma.targetMetric.deleteMany();
  await prisma.publicationTarget.deleteMany();
  await prisma.publication.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: {
      email: 'marketing@almaquinta.com',
      name: 'Equipo Marketing',
    },
  });

  const post1 = await prisma.publication.create({
    data: {
      userId: user.id,
      originalPrompt: 'Campaña de ciberseguridad corporativa para B2B',
      copy: 'Protege la infraestructura de tu empresa contra ataques modernos. Conoce nuestras soluciones integrales.',
      mediaUrl: 'https://www.esic.edu/sites/default/files/2024-07/que%20es%20la%20ciberseguridad.jpg',
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
