"use client";

import { useState } from "react";
import {
  retryPublication,
  type PublicationTarget,
  type RetryablePlatform,
  type TargetFailureKind,
} from "@/features/publications/api";
import type { PublicationStatus } from "@/features/publications/schemas";
import { formatLabel, platformLabel } from "@/features/publications/components/StatusBadges";
import { Modal } from "@/shared/components/Modal";

const MAX_TARGET_RETRIES = 3;

const KIND_LABEL: Readonly<Record<TargetFailureKind, string>> = {
  AUTH: "Credenciales",
  PERMISSION: "Permisos",
  RATE_LIMIT: "Límite de Meta",
  TRANSIENT: "Error temporal",
  MEDIA: "Archivo multimedia",
  CONTENT: "Contenido",
  ACCOUNT: "Cuenta",
  PROVIDER_REJECTED: "Solicitud rechazada",
  UNKNOWN_OUTCOME: "Estado desconocido",
  UNKNOWN: "Error desconocido",
};

function isRetryablePlatform(platform: PublicationTarget["platform"]): platform is RetryablePlatform {
  return platform === "FACEBOOK" || platform === "INSTAGRAM";
}

function canRetryTarget(target: PublicationTarget, terminal: boolean): boolean {
  return (
    terminal &&
    target.status === "FAILED" &&
    isRetryablePlatform(target.platform) &&
    target.failure?.retryable === true &&
    target.retryCount < MAX_TARGET_RETRIES
  );
}

/**
 * Panel de fallos por canal. Muestra primero la causa y la acción sugerida;
 * solo ofrece reintento para Facebook/Instagram cuando el backend clasificó
 * el fallo como seguro. Nunca incluye canales exitosos en el reintento.
 */
export function PublicationFailures({
  publicationId,
  status,
  targets,
  isAdmin,
  onChanged,
}: {
  readonly publicationId: string;
  readonly status: PublicationStatus;
  readonly targets: PublicationTarget[];
  readonly isAdmin: boolean;
  onChanged: () => void;
}) {
  const [selected, setSelected] = useState<RetryablePlatform[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const failed = targets.filter((target) => target.status === "FAILED");
  if (failed.length === 0) {
    return null;
  }

  const terminal = status === "PARTIAL" || status === "FAILED";
  const retryable = failed.filter((target) => canRetryTarget(target, terminal));

  const confirmRetry = async () => {
    if (selected === null) return;
    setErrorMsg("");
    setBusy(true);
    try {
      await retryPublication(publicationId, selected);
      setSelected(null);
      onChanged();
    } catch (error: unknown) {
      setErrorMsg(error instanceof Error ? error.message : "No se pudo programar el reintento");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] p-6 shadow-xs flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-[#083A3D] dark:text-white">
            Fallos de publicación
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {failed.length === 1
              ? "1 canal no se pudo publicar."
              : `${failed.length} canales no se pudieron publicar.`}{" "}
            El reintento solo vuelve a enviar los canales fallidos seleccionados.
          </p>
        </div>
        {isAdmin && retryable.length > 1 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setErrorMsg("");
              setSelected(retryable.map((target) => target.platform as RetryablePlatform));
            }}
            className="text-xs font-medium rounded-[10px] px-4 h-[36px] cursor-pointer bg-[#151717] text-white hover:bg-[#252727] disabled:opacity-50 transition-colors"
          >
            Reintentar canales de Meta
          </button>
        )}
      </div>

      {errorMsg !== "" && <p className="text-sm text-red-500 font-medium">{errorMsg}</p>}

      <div className="flex flex-col gap-3">
        {failed.map((target) => {
          const failure = target.failure;
          const retryableTarget = canRetryTarget(target, terminal);
          const retryPlatform = isRetryablePlatform(target.platform) ? target.platform : null;
          return (
            <article
              key={target.id}
              className="rounded-[14px] border border-gray-100 dark:border-[#2d374e] bg-gray-50/60 dark:bg-[#1b2234] p-4 flex flex-col gap-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-[#151717] dark:text-white">
                  {platformLabel(target.platform)}
                </span>
                <span className="text-[11px] rounded-full px-2 py-0.5 bg-white dark:bg-[#232a3e] border border-gray-200 dark:border-[#2d374e] text-gray-600 dark:text-gray-300">
                  {formatLabel(target.format)}
                </span>
                {failure !== null && (
                  <span className="text-[11px] rounded-full px-2 py-0.5 bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400">
                    {KIND_LABEL[failure.kind]}
                  </span>
                )}
                {terminal && !retryableTarget && (
                  <span className="text-[11px] rounded-full px-2 py-0.5 bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
                    Sin reintento
                  </span>
                )}
              </div>

              <p className="text-sm text-[#151717] dark:text-white">
                {failure?.message ??
                  target.errorMessage ??
                  "La red social rechazó la publicación sin detallar la causa."}
              </p>
              {failure !== null && failure.action !== "" && (
                <p className="text-xs text-gray-600 dark:text-gray-300">{failure.action}</p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                {retryPlatform !== null && (
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    Reintentos usados: {target.retryCount} de {MAX_TARGET_RETRIES}
                  </span>
                )}
                {retryPlatform === null && (
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    El reintento automático solo está disponible para Facebook e Instagram.
                  </span>
                )}
                {isAdmin && retryableTarget && retryPlatform !== null && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setErrorMsg("");
                      setSelected([retryPlatform]);
                    }}
                    className="text-xs font-medium rounded-[10px] px-3.5 h-[32px] cursor-pointer bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    Reintentar {platformLabel(target.platform)}
                  </button>
                )}
              </div>

              {failure !== null && (
                <details className="text-[11px] text-gray-500 dark:text-gray-400">
                  <summary className="cursor-pointer select-none">Detalle técnico</summary>
                  <dl className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1">
                    {failure.code !== null && (
                      <>
                        <dt>Código</dt>
                        <dd>{failure.code}</dd>
                      </>
                    )}
                    {failure.subcode !== null && (
                      <>
                        <dt>Subcódigo</dt>
                        <dd>{failure.subcode}</dd>
                      </>
                    )}
                    {failure.httpStatus !== null && (
                      <>
                        <dt>HTTP</dt>
                        <dd>{failure.httpStatus}</dd>
                      </>
                    )}
                    <dt>Etapa</dt>
                    <dd>
                      {failure.stage === "PUBLISH" ? "Publicación" : "Preparación del archivo"}
                    </dd>
                  </dl>
                  {failure.providerMessage !== null && (
                    <p className="mt-2 break-words whitespace-pre-wrap">{failure.providerMessage}</p>
                  )}
                  {failure.traceId !== null && (
                    <p className="mt-1 break-all">Trace: {failure.traceId}</p>
                  )}
                </details>
              )}
            </article>
          );
        })}
      </div>

      {!terminal && status === "PROCESSING" && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Esperando el reporte de los canales restantes. El reintento se habilita cuando la
          publicación termina.
        </p>
      )}
      {terminal && isAdmin && retryable.length === 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Estos fallos no tienen reintentos disponibles. Revisa la acción sugerida o crea una
          nueva publicación.
        </p>
      )}
      {terminal && !isAdmin && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Solo un administrador puede reintentar los canales fallidos.
        </p>
      )}

      <Modal
        title="Reintentar publicación"
        open={selected !== null}
        onClose={() => {
          if (!busy) setSelected(null);
        }}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Se reintentará solo{" "}
            <strong>
              {selected?.map((platform) => platformLabel(platform)).join(", ") ?? ""}
            </strong>
            . Los canales que ya se publicaron no se vuelven a enviar.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            No se pedirá una nueva aprobación. Se reutiliza la aprobación original y n8n
            procesará únicamente los canales seleccionados.
          </p>
          {errorMsg !== "" && <p className="text-sm text-red-500 font-medium">{errorMsg}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setSelected(null)}
              className="text-xs font-medium rounded-[10px] px-4 h-[36px] cursor-pointer text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#2d374e] disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void confirmRetry()}
              className="text-xs font-medium rounded-[10px] px-4 h-[36px] cursor-pointer bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {busy ? "Programando…" : "Confirmar reintento"}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
