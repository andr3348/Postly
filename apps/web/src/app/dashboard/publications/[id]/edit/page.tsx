import { PublicationEditorLoader } from "@/features/publications/components/PublicationsLoader";

export default async function PublicationEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PublicationEditorLoader id={id} />;
}
