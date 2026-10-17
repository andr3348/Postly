import { PublicationDetailLoader } from "@/features/publications/components/PublicationsLoader";

export default async function PublicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PublicationDetailLoader id={id} />;
}
