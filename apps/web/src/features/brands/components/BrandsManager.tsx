"use client";

import { Suspense, use, useState } from "react";
import {
  createBrand,
  deleteBrand,
  getBrandsCached,
  invalidateBrands,
  updateBrand,
  type Brand,
} from "@/features/brands/api";
import type { BrandFormInput } from "@/features/brands/schemas";
import { useBrand } from "@/features/brands/BrandContext";
import { BrandForm } from "@/features/brands/components/BrandForm";

export function BrandsManager() {
  const [version, setVersion] = useState(0);

  const refresh = () => {
    invalidateBrands();
    setVersion((current) => current + 1);
  };

  return (
    <Suspense
      fallback={
        <div className="bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] p-8 shadow-xs text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Cargando marcas…</p>
        </div>
      }
    >
      <ManagerInner key={version} version={version} onChanged={refresh} />
    </Suspense>
  );
}

function ManagerInner({ version, onChanged }: { version: number; onChanged: () => void }) {
  const { brands } = use(getBrandsCached(version));
  const { selectedId } = useBrand();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const currentId = selectedId ?? brands[0]?.id ?? null;

  const handleCreate = async (data: BrandFormInput) => {
    await createBrand(data);
    setShowCreate(false);
    onChanged();
  };

  const handleUpdate = async (id: string, data: BrandFormInput) => {
    await updateBrand(id, data);
    setEditingId(null);
    onChanged();
  };

  const handleDelete = async (id: string) => {
    setErrorMsg("");
    try {
      await deleteBrand(id);
      setConfirmingId(null);
      onChanged();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "No se pudo eliminar");
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg sm:text-xl font-semibold text-[#083A3D] dark:text-white">
          Marcas
        </h1>
        {!showCreate && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="bg-[#151717] text-white text-sm font-medium rounded-[10px] px-5 h-[42px] cursor-pointer hover:bg-[#252727] dark:bg-white dark:text-[#151717] dark:hover:bg-gray-200 transition-colors duration-200"
          >
            Nueva marca
          </button>
        )}
      </div>

      {errorMsg !== "" && (
        <p className="text-sm text-red-500 font-medium">{errorMsg}</p>
      )}

      {showCreate && (
        <div className="bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] p-6 shadow-xs">
          <h2 className="text-base font-semibold text-[#083A3D] dark:text-white mb-4">
            Nueva marca
          </h2>
          <BrandForm
            submitLabel="Crear marca"
            onSubmit={handleCreate}
            onCancel={() => setShowCreate(false)}
          />
        </div>
      )}

      {brands.length === 0 && !showCreate ? (
        <div className="bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] p-8 shadow-xs text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Sin marcas todavía. Crea la primera para empezar a publicar.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {brands.map((brand) =>
            editingId === brand.id ? (
              <div
                key={brand.id}
                className="bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] p-6 shadow-xs"
              >
                <h2 className="text-base font-semibold text-[#083A3D] dark:text-white mb-4">
                  Editar marca
                </h2>
                <BrandForm
                  initial={{
                    name: brand.name,
                    logoUrl: brand.logoUrl,
                    websiteUrl: brand.websiteUrl,
                    aiTone: brand.aiTone,
                    aiBrandVoice: brand.aiBrandVoice,
                    aiTargetAudience: brand.aiTargetAudience,
                    defaultHashtags: brand.defaultHashtags,
                  }}
                  submitLabel="Guardar cambios"
                  onSubmit={(data) => handleUpdate(brand.id, data)}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            ) : (
              <article
                key={brand.id}
                className="bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] p-6 shadow-xs flex flex-col gap-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-[#083A3D] dark:text-white truncate">
                    {brand.name}
                  </h2>
                  {brand.id === currentId && (
                    <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 px-2.5 py-1 rounded-full shrink-0">
                      Actual
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {brand.aiTone}
                </p>
                {brand.defaultHashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {brand.defaultHashtags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[11px] font-medium bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(brand.id);
                      setConfirmingId(null);
                    }}
                    className="text-xs font-medium rounded-[10px] px-4 h-[36px] cursor-pointer text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#2d374e] transition-colors"
                  >
                    Editar
                  </button>
                  {confirmingId === brand.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleDelete(brand.id)}
                        className="text-xs font-medium rounded-[10px] px-4 h-[36px] cursor-pointer bg-red-600 text-white hover:bg-red-700 transition-colors"
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        className="text-xs font-medium rounded-[10px] px-4 h-[36px] cursor-pointer text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#2d374e] transition-colors"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmingId(brand.id);
                        setEditingId(null);
                      }}
                      className="text-xs font-medium rounded-[10px] px-4 h-[36px] cursor-pointer text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </article>
            ),
          )}
        </div>
      )}
    </div>
  );
}
