"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AiAssistantPanel } from "@/features/ai/components/AiAssistantPanel";
import {
  getPublicationCached,
  invalidatePublications,
  updateDraft,
} from "@/features/publications/api";
import {
  PublicationForm,
  type PublicationFormFill,
} from "@/features/publications/components/PublicationForm";
import { PublicationStatusBadge } from "@/features/publications/components/StatusBadges";
import type {
  CreatePublicationFormInput,
  UpdateDraftFormInput,
} from "@/features/publications/schemas";

/**
 * Edición de un borrador con la misma vista que "Nueva publicación": panel IA
 * (Texto/Ideas, sin Agente porque crearía otro borrador) + formulario. Los
 * canales y el flujo siguen viviendo en el detalle.
 */
export function PublicationEditor({ id }: { id: string }) {
  return (
    <Suspense
      fallback={
        <div className="bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] p-8 shadow-xs text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Cargando borrador…</p>
        </div>
      }
    >
      <EditorInner id={id} />
    </Suspense>
  );
}

function EditorInner({ id }: { id: string }) {
  const router = useRouter();
  const publication = use(getPublicationCached(id, 0));
  const [fill, setFill] = useState<PublicationFormFill>();
  const detailHref = `/dashboard/publications/${id}`;

  const handleUseText = (data: {
    title: string;
    copy: string;
    originalPrompt: string;
    modelText: string;
  }): void => {
    setFill((current) => ({
      ...data,
      nonce: (current?.nonce ?? 0) + 1,
    }));
    window.requestAnimationFrame(() => {
      document.getElementById("publication-form")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const handleSave = async (
    data: CreatePublicationFormInput | UpdateDraftFormInput,
  ): Promise<void> => {
    await updateDraft(id, {
      originalPrompt: data.originalPrompt,
      title: data.title,
      copy: data.copy,
      mediaUrl: data.mediaUrl,
      mediaType: data.mediaType,
    });
    invalidatePublications();
    router.replace(detailHref);
  };

  if (publication.status !== "DRAFT") {
    return (
      <div className="bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] p-8 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-base sm:text-lg font-semibold text-[#083A3D] dark:text-white">
            Solo se editan borradores
          </h1>
          <PublicationStatusBadge status={publication.status} />
        </div>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Esta publicación ya entró al flujo de aprobación o publicación. Revisa
          sus canales y estado en el detalle.
        </p>
        <Link
          href={detailHref}
          className="mt-4 inline-flex h-[36px] items-center rounded-[10px] bg-[#151717] px-4 text-xs font-medium text-white transition-colors hover:bg-[#252727]"
        >
          Volver al detalle
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <div>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-lg sm:text-xl font-semibold text-[#083A3D] dark:text-white">
            Editar borrador
          </h1>
          <PublicationStatusBadge status={publication.status} />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Misma vista que crear: ajusta el texto y la media; los canales y el
          flujo se gestionan en su detalle.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <AiAssistantPanel
          key={publication.brandId}
          brandId={publication.brandId}
          hideAgent
          initialCopy={publication.copy}
          onUseText={handleUseText}
        />
        <div
          id="publication-form"
          className="scroll-mt-6 bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] p-6 shadow-xs"
        >
          <div className="mb-4">
            <h2 className="text-base font-semibold text-[#083A3D] dark:text-white">
              Datos de la publicación
            </h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Puedes usar el texto del asistente o editarlo manualmente.
            </p>
          </div>
          <PublicationForm
            mode="edit"
            initial={{
              originalPrompt: publication.originalPrompt,
              title: publication.title ?? "",
              copy: publication.copy,
              mediaUrl: publication.mediaUrl,
              mediaType: publication.mediaType,
            }}
            fill={fill}
            submitLabel="Guardar cambios"
            onSubmit={handleSave}
            onCancel={() => router.push(detailHref)}
          />
        </div>
      </div>
    </div>
  );
}
