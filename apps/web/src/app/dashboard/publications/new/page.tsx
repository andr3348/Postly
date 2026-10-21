"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AiAssistantPanel } from "@/features/ai/components/AiAssistantPanel";
import { useBrand } from "@/features/brands/BrandContext";
import { createPublication, invalidatePublications } from "@/features/publications/api";
import {
  PublicationForm,
  type PublicationFormFill,
} from "@/features/publications/components/PublicationForm";
import type {
  CreatePublicationFormInput,
  UpdateDraftFormInput,
} from "@/features/publications/schemas";

/**
 * Crea un borrador y navega a su detalle (targets y flujo viven ahí).
 * El `brandId` se toma del contexto en el momento de enviar: no se renderiza
 * de él, así no hay riesgo de hidratación con el localStorage.
 */
export default function NewPublicationPage() {
  const router = useRouter();
  const { selectedId } = useBrand();
  const [fill, setFill] = useState<PublicationFormFill>();

  const handleUseText = (data: {
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

  const handleCreate = async (
    data: CreatePublicationFormInput | UpdateDraftFormInput,
  ): Promise<void> => {
    if (selectedId === null) {
      throw new Error("Selecciona una marca en el switcher (o crea una)");
    }
    // Al crear el schema exige copy y mediaUrl: el guard lo hace explícito.
    if (data.copy === undefined || data.mediaUrl === undefined) {
      throw new Error("Falta el texto o la URL de media");
    }
    const created = await createPublication({
      brandId: selectedId,
      originalPrompt: data.originalPrompt,
      title: data.title,
      copy: data.copy,
      mediaUrl: data.mediaUrl,
      mediaType: data.mediaType,
      ...("modelText" in data && data.modelText !== undefined
        ? { modelText: data.modelText }
        : {}),
    });
    invalidatePublications();
    router.replace(`/dashboard/publications/${created.id}`);
  };

  return (
    <div className="flex flex-col gap-5 pb-6">
      <div>
        <h1 className="text-lg sm:text-xl font-semibold text-[#083A3D] dark:text-white">
          Nueva publicación
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Se guarda como borrador de la marca activa; los canales y el flujo se
          gestionan en su detalle.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <AiAssistantPanel
          key={selectedId ?? "no-brand"}
          brandId={selectedId}
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
              Puedes usar el texto del asistente o escribirlo manualmente.
            </p>
          </div>
          <PublicationForm
            mode="create"
            brandId={selectedId ?? undefined}
            fill={fill}
            submitLabel="Crear borrador"
            onSubmit={handleCreate}
          />
        </div>
      </div>
    </div>
  );
}
