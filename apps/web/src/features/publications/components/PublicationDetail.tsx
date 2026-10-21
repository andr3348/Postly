"use client";

import { Suspense, use, useState } from "react";
import Image from "next/image";
import {
  addTarget,
  approvePublication,
  getPublicationCached,
  getTargetsCached,
  getTargetMetricsCached,
  invalidatePublications,
  publishNow,
  rejectPublication,
  removeTarget,
  recordMetric,
  submitPublication,
  updateDraft,
  updateTargetFormat,
  type PublicationTarget,
} from "@/features/publications/api";
import { invalidateAnalytics } from "@/features/analytics/api";
import {
  formatLabel,
  platformLabel,
  PublicationStatusBadge,
  TargetStatusBadge,
} from "@/features/publications/components/StatusBadges";
import { PublicationForm } from "@/features/publications/components/PublicationForm";
import { PublicationFailures } from "@/features/publications/components/PublicationFailures";
import {
  publicationFormatSchema,
  recordMetricFormSchema,
  type PublicationFormat,
  type PublicationMedia,
  type PublicationPlatform,
} from "@/features/publications/schemas";
import { getBrandsCached } from "@/features/brands/api";
import { useSessionUser } from "@/features/auth/session";
import { Modal } from "@/shared/components/Modal";
import { FacebookIcon, InstagramIcon, LinkedinIcon, TiktokIcon } from "@/shared/components/icons/DashboardIcons";
import { formatDateTime } from "@/lib/format";

const PLATFORMS: ReadonlyArray<{ readonly platform: PublicationPlatform; readonly Icon: typeof FacebookIcon }> = [
  { platform: "FACEBOOK", Icon: FacebookIcon },
  { platform: "INSTAGRAM", Icon: InstagramIcon },
  { platform: "LINKEDIN", Icon: LinkedinIcon },
  { platform: "TIKTOK", Icon: TiktokIcon },
];

export function PublicationDetail({ id }: { id: string }) {
  const [version, setVersion] = useState(0);

  const refresh = () => {
    invalidatePublications();
    // Los agregados de Informes derivan de publicaciones/targets/métricas.
    invalidateAnalytics();
    setVersion((current) => current + 1);
  };

  return (
    <Suspense
      fallback={
        <div className="bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] p-8 shadow-xs text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Cargando publicación…</p>
        </div>
      }
    >
      <DetailInner key={version} id={id} version={version} onChanged={refresh} />
    </Suspense>
  );
}

interface DetailProps {
  readonly id: string;
  readonly version: number;
  readonly onChanged: () => void;
}

function DetailInner({ id, version, onChanged }: DetailProps) {
  const publication = use(getPublicationCached(id, version));
  const targets = use(getTargetsCached(id, version));
  const { brands } = use(getBrandsCached());
  const user = useSessionUser();

  const [editing, setEditing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [publishingNow, setPublishingNow] = useState(false);
  const [flowMsg, setFlowMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const isAdminUser = user?.role === "ADMIN";
  const isOwner = user !== null && publication.userId === user.id;
  const canEditContent = publication.status === "DRAFT" && (isOwner || isAdminUser);
  const canEditTargets =
    (publication.status === "DRAFT" || publication.status === "PENDING_APPROVAL") &&
    (isOwner || isAdminUser);
  const canSubmit = publication.status === "DRAFT" && (isOwner || isAdminUser);
  const hasTargets = targets.length > 0;
  const canReview = publication.status === "PENDING_APPROVAL" && isAdminUser;
  const brandName = brands.find((b) => b.id === publication.brandId)?.name ?? publication.brandId;

  const runFlow = async (action: () => Promise<unknown>, onDone?: () => void) => {
    setFlowMsg("");
    setBusy(true);
    try {
      await action();
      onDone?.();
      onChanged();
    } catch (err: unknown) {
      setFlowMsg(err instanceof Error ? err.message : "No se pudo completar la acción");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3.5 pb-6">
      {/* Encabezado + flujo */}
      <section className="bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] p-6 shadow-xs flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-base sm:text-lg font-semibold text-[#083A3D] dark:text-white truncate">
                {brandName}
              </h1>
              <PublicationStatusBadge status={publication.status} />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Creada {formatDateTime(publication.createdAt)} · Actualizada{" "}
              {formatDateTime(publication.updatedAt)}
              {publication.scheduledAt !== null &&
                ` · Programada para ${formatDateTime(publication.scheduledAt)}`}
            </p>
            {publication.approvedById !== null && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Aprobada {formatDateTime(publication.approvedAt)} por {publication.approvedById}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {canEditContent && (
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                  setFlowMsg("");
                }}
                className="text-xs font-medium rounded-[10px] px-4 h-[36px] cursor-pointer text-gray-700 border border-gray-200 dark:text-gray-300 dark:border-[#2d374e] hover:bg-gray-100 dark:hover:bg-[#2d374e] transition-colors"
              >
                Editar borrador
              </button>
            )}
            {canSubmit && (
              <button
                type="button"
                disabled={busy || !hasTargets}
                onClick={() => void runFlow(() => submitPublication(id))}
                className="text-xs font-medium rounded-[10px] px-4 h-[36px] cursor-pointer bg-[#151717] text-white hover:bg-[#252727] disabled:opacity-50 transition-colors"
              >
                Enviar a aprobación
              </button>
            )}
            {canReview && (
              <>
                {publishingNow ? (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void runFlow(() => publishNow(id), () => setPublishingNow(false))
                      }
                      className="text-xs font-medium rounded-[10px] px-4 h-[36px] cursor-pointer bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      {busy ? "Publicando…" : "Confirmar publicación"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPublishingNow(false)}
                      className="text-xs font-medium rounded-[10px] px-4 h-[36px] cursor-pointer text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#2d374e] transition-colors"
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setApproving(true);
                        setPublishingNow(false);
                        setFlowMsg("");
                      }}
                      className="text-xs font-medium rounded-[10px] px-4 h-[36px] cursor-pointer bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      Aprobar
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setPublishingNow(true);
                        setRejecting(false);
                        setFlowMsg("");
                      }}
                      className="text-xs font-medium rounded-[10px] px-4 h-[36px] cursor-pointer bg-[#151717] text-white hover:bg-[#252727] disabled:opacity-50 transition-colors"
                    >
                      Publicar ahora
                    </button>
                    {rejecting ? (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void runFlow(() => rejectPublication(id), () => setRejecting(false))}
                          className="text-xs font-medium rounded-[10px] px-4 h-[36px] cursor-pointer bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                          Confirmar rechazo
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejecting(false)}
                          className="text-xs font-medium rounded-[10px] px-4 h-[36px] cursor-pointer text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#2d374e] transition-colors"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setRejecting(true);
                          setPublishingNow(false);
                        }}
                        className="text-xs font-medium rounded-[10px] px-4 h-[36px] cursor-pointer text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                      >
                        Rechazar
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {canSubmit && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {hasTargets
              ? "Se envía a revisión (PENDING_APPROVAL) para que un ADMIN la programe."
              : "Agrega al menos un canal en «Canales destino» para poder enviar a aprobación."}
          </p>
        )}
        {publication.status === "PENDING_APPROVAL" && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            {publishingNow
              ? "Se usará la fecha actual y se despertará a n8n para publicar de inmediato. No se puede cancelar una vez iniciado el despacho."
              : isAdminUser
                ? "Admin: puedes aprobar (agendar), publicar ahora o rechazar (devolver a borrador)."
                : "Pendiente de aprobación por un administrador."}
          </p>
        )}
        {flowMsg !== "" && <p className="text-sm text-red-500 font-medium">{flowMsg}</p>}

        {/* Contenido */}
        <div className="flex flex-col gap-3 border-t border-gray-100 dark:border-[#2d374e] pt-4">
          {publication.originalPrompt !== "" && (
            <div>
              <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                Prompt original
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line">
                {publication.originalPrompt}
              </p>
            </div>
          )}
          <div>
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
              Copy
            </h2>
            <p className="text-sm text-[#151717] dark:text-white whitespace-pre-line">
              {publication.copy}
            </p>
          </div>
          <MediaPreview url={publication.mediaUrl} type={publication.mediaType} name={brandName} />
        </div>
      </section>

      {/* Fallos por canal: causa primero y reintento seguro */}
      <PublicationFailures
        publicationId={id}
        status={publication.status}
        targets={targets}
        isAdmin={isAdminUser}
        onChanged={onChanged}
      />

      {/* Destinos (canales) */}
      <TargetsSection
        id={id}
        version={version}
        editable={canEditTargets}
        mediaType={publication.mediaType}
        onChanged={onChanged}
      />

      {/* Métricas */}
      <MetricsSection id={id} version={version} canRecord={isOwner || isAdminUser} onChanged={onChanged} />

      {/* Modal editar borrador */}
      <Modal title="Editar borrador" open={editing} onClose={() => setEditing(false)}>
        {editing && (
          <PublicationForm
            mode="edit"
            initial={{
              originalPrompt: publication.originalPrompt,
              copy: publication.copy,
              mediaUrl: publication.mediaUrl,
              mediaType: publication.mediaType,
            }}
            submitLabel="Guardar cambios"
            onSubmit={(data) => updateDraft(id, {
              originalPrompt: data.originalPrompt,
              copy: data.copy,
              mediaUrl: data.mediaUrl,
              mediaType: data.mediaType,
            })}
            onCancel={() => setEditing(false)}
          />
        )}
      </Modal>

      {/* Modal aprobar (agendar) */}
      <ApproveModal
        open={approving}
        busy={busy}
        onClose={() => setApproving(false)}
        onConfirm={(scheduledAt) =>
          runFlow(() => approvePublication(id, scheduledAt), () => setApproving(false))
        }
      />
    </div>
  );
}

/** Vista previa de media: IMAGE usa next/image (unoptimized), VIDEO un <video>. */
function MediaPreview({ url, type, name }: { url: string; type: string; name: string }) {
  const safe = /^https?:\/\//i.test(url.trim());
  if (!safe) return null;

  return (
    <div>
      <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
        Media ({type === "VIDEO" ? "video" : "imagen"})
      </h2>
      {type === "VIDEO" ? (
        <video controls src={url.trim()} className="w-full max-w-md rounded-[18px]" />
      ) : (
        <span className="relative block w-full max-w-md h-64 rounded-[18px] overflow-hidden border border-gray-100 dark:border-[#2d374e]">
          <Image
            src={url.trim()}
            alt={`Media de ${name}`}
            fill
            sizes="(max-width: 768px) 100vw, 448px"
            unoptimized
            className="object-contain bg-gray-50 dark:bg-slate-800"
          />
        </span>
      )}
    </div>
  );
}

function TargetsSection({
  id,
  version,
  editable,
  mediaType,
  onChanged,
}: {
  id: string;
  version: number;
  editable: boolean;
  mediaType: PublicationMedia;
  onChanged: () => void;
}) {
  return (
    <Suspense
      fallback={
        <div className="bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] p-6 shadow-xs text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Cargando canales…</p>
        </div>
      }
    >
      <TargetsInner
        id={id}
        version={version}
        editable={editable}
        mediaType={mediaType}
        onChanged={onChanged}
      />
    </Suspense>
  );
}

function TargetsInner({
  id,
  version,
  editable,
  mediaType,
  onChanged,
}: {
  id: string;
  version: number;
  editable: boolean;
  mediaType: PublicationMedia;
  onChanged: () => void;
}) {
  const targets = use(getTargetsCached(id, version));
  const attached = new Set(targets.map((t) => t.platform));
  const [confirming, setConfirming] = useState<PublicationPlatform | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const runTargetChange = async (action: () => Promise<unknown>) => {
    setErrorMsg("");
    setBusy(true);
    try {
      await action();
      setConfirming(null);
      onChanged();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "No se pudo actualizar el canal");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] p-6 shadow-xs flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-[#083A3D] dark:text-white">
          Canales destino
        </h2>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {targets.length === 0
            ? "Sin canales"
            : `${targets.length} canal${targets.length === 1 ? "" : "es"}`}
        </span>
      </div>
      {mediaType === "VIDEO" && (
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          En Instagram ambos formatos se comparten al feed. En Facebook, Feed y Reel
          usan flujos de publicación distintos.
        </p>
      )}
      {errorMsg !== "" && <p className="text-sm text-red-500 font-medium">{errorMsg}</p>}

      {targets.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Agrega al menos un canal: es requisito para enviar a aprobación.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2.5">
        {targets.map((target) => (
          <TargetChip
            key={target.platform}
            target={target}
            editable={editable}
            busy={busy}
            mediaType={mediaType}
            confirming={confirming}
            onConfirm={() => void runTargetChange(() => removeTarget(id, target.platform))}
            onCancel={() => setConfirming(null)}
            onAskRemove={() => setConfirming(target.platform)}
            onFormatChange={(format) =>
              void runTargetChange(() => updateTargetFormat(id, target.platform, format))
            }
          />
        ))}
        {editable &&
          PLATFORMS.filter(({ platform }) => !attached.has(platform)).map(({ platform, Icon }) => (
            <button
              key={platform}
              type="button"
              disabled={busy}
              onClick={() => void runTargetChange(() => addTarget(id, platform))}
              className="flex items-center gap-2 text-xs font-medium rounded-full px-3.5 py-2 cursor-pointer border border-dashed border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:border-[#2d79f3] hover:text-[#2d79f3] disabled:opacity-50 transition-colors"
            >
              <Icon className="w-4 h-4" />
              Agregar {platformLabel(platform)}
            </button>
          ))}
      </div>
    </section>
  );
}

function TargetChip({
  target,
  editable,
  busy,
  mediaType,
  confirming,
  onConfirm,
  onCancel,
  onAskRemove,
  onFormatChange,
}: {
  target: PublicationTarget;
  editable: boolean;
  busy: boolean;
  mediaType: PublicationMedia;
  confirming: PublicationPlatform | null;
  onConfirm: () => void;
  onCancel: () => void;
  onAskRemove: () => void;
  onFormatChange: (format: PublicationFormat) => void;
}) {
  const canChooseFormat =
    mediaType === "VIDEO" &&
    (target.platform === "FACEBOOK" || target.platform === "INSTAGRAM");

  return (
    <span className="flex flex-wrap items-center gap-2 text-xs font-medium rounded-full px-3 py-2 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-200">
      {platformLabel(target.platform)}
      {editable && canChooseFormat ? (
        <select
          aria-label={`Formato de ${platformLabel(target.platform)}`}
          value={target.format}
          disabled={busy}
          onChange={(event) => {
            const parsed = publicationFormatSchema.safeParse(event.target.value);
            if (parsed.success) onFormatChange(parsed.data);
          }}
          className="text-[11px] font-semibold rounded-full px-2 py-0.5 cursor-pointer border border-gray-200 dark:border-slate-600 bg-transparent text-gray-700 dark:text-gray-200 disabled:opacity-50"
        >
          <option value="FEED">Feed</option>
          <option value="REEL">Reel</option>
        </select>
      ) : (
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300">
          {formatLabel(target.format)}
        </span>
      )}
      <TargetStatusBadge status={target.status} />
      {editable &&
        (confirming === target.platform ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={onConfirm}
              className="text-[11px] font-semibold text-red-600 hover:underline disabled:opacity-50 cursor-pointer"
            >
              Confirmar
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="text-[11px] font-semibold text-gray-500 hover:underline cursor-pointer"
            >
              Cancelar
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={onAskRemove}
            className="text-[11px] font-semibold text-red-600 hover:underline disabled:opacity-50 cursor-pointer"
          >
            Quitar
          </button>
        ))}
    </span>
  );
}

function ApproveModal({
  open,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: (scheduledAt: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const confirm = async () => {
    if (value === "") {
      setErrorMsg("Elige fecha y hora");
      return;
    }
    setErrorMsg("");
    try {
      // datetime-local no trae zona: convertimos a ISO con la hora del cliente.
      await onConfirm(new Date(value).toISOString());
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "No se pudo programar");
    } finally {
      setValue("");
    }
  };

  return (
    <Modal title="Aprobar y programar" open={open} onClose={onClose}>
      <div className="flex flex-col gap-3">
        {errorMsg !== "" && (
          <p className="text-red-500 text-sm text-center font-medium">{errorMsg}</p>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-[#151717] dark:text-gray-200 font-semibold text-sm">
            Fecha y hora de publicación
          </span>
          <input
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="rounded-[10px] border-[1.5px] border-[#ecedec] dark:border-slate-700 px-3 h-[46px] focus:outline-none focus:border-[#2d79f3] bg-transparent text-[#151717] dark:text-white text-sm w-full"
          />
        </label>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          Al aprobar la publicación pasa a SCHEDULED; n8n despacha cuando la fecha llegue.
        </p>
        <div className="flex gap-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => void confirm()}
            className="bg-emerald-600 text-white text-sm font-medium rounded-[10px] px-6 h-[44px] cursor-pointer hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            Aprobar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium rounded-[10px] px-6 h-[44px] cursor-pointer text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#2d374e] transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  );
}

function MetricsSection({
  id,
  version,
  canRecord,
  onChanged,
}: {
  id: string;
  version: number;
  canRecord: boolean;
  onChanged: () => void;
}) {
  return (
    <Suspense
      fallback={
        <div className="bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] p-6 shadow-xs text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Cargando métricas…</p>
        </div>
      }
    >
      <MetricsInner id={id} version={version} canRecord={canRecord} onChanged={onChanged} />
    </Suspense>
  );
}

function MetricsInner({
  id,
  version,
  canRecord,
  onChanged,
}: {
  id: string;
  version: number;
  canRecord: boolean;
  onChanged: () => void;
}) {
  const targets = use(getTargetsCached(id, version));
  const target = targets[0] ?? null;

  if (target === null) {
    return (
      <section className="bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] p-6 shadow-xs">
        <h2 className="text-base font-semibold text-[#083A3D] dark:text-white">
          Métricas
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Las métricas se registran por canal una vez publicado (via n8n).
        </p>
      </section>
    );
  }

  return <PlatformMetrics id={id} platform={target.platform} version={version} canRecord={canRecord} onChanged={onChanged} />;
}

function PlatformMetrics({
  id,
  platform,
  version,
  canRecord,
  onChanged,
}: {
  id: string;
  platform: PublicationPlatform;
  version: number;
  canRecord: boolean;
  onChanged: () => void;
}) {
  const metrics = use(getTargetMetricsCached(id, platform, version));

  return (
    <section className="bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] p-6 shadow-xs flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-[#083A3D] dark:text-white">
          Métricas · {platformLabel(platform)}
        </h2>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {metrics.length === 0 ? "Sin snapshots" : `${metrics.length} snapshot(s)`}
        </span>
      </div>

      {metrics.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-[#2d374e]">
                <th className="py-2 pr-3 font-semibold">Capturado</th>
                <th className="py-2 pr-3 font-semibold">Impresiones</th>
                <th className="py-2 pr-3 font-semibold">Likes</th>
                <th className="py-2 pr-3 font-semibold">Comentarios</th>
                <th className="py-2 pr-3 font-semibold">Shares</th>
                <th className="py-2 font-semibold">Clicks</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 dark:text-gray-200">
              {metrics.map((m) => (
                <tr key={m.id} className="border-b border-gray-50 dark:border-[#2d374e]/60">
                  <td className="py-2 pr-3">{formatDateTime(m.capturedAt)}</td>
                  <td className="py-2 pr-3">{m.impressions}</td>
                  <td className="py-2 pr-3">{m.likes}</td>
                  <td className="py-2 pr-3">{m.comments}</td>
                  <td className="py-2 pr-3">{m.shares}</td>
                  <td className="py-2">{m.clicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canRecord && <MetricRecorder id={id} platform={platform} onChanged={onChanged} />}
    </section>
  );
}

/** Registro manual de snapshot (dueño/admin sobre canal SUCCESS): demo/puente hasta n8n. */
function MetricRecorder({
  id,
  platform,
  onChanged,
}: {
  id: string;
  platform: PublicationPlatform;
  onChanged: () => void;
}) {
  const FIELD_NAMES = ["Impresiones", "Likes", "Comentarios", "Shares", "Clicks"];
  const [values, setValues] = useState<string[]>(["", "", "", "", ""]);
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setErrorMsg("");
    const parsed = recordMetricFormSchema.safeParse({
      impressions: toIntOrUndef(values[0]),
      likes: toIntOrUndef(values[1]),
      comments: toIntOrUndef(values[2]),
      shares: toIntOrUndef(values[3]),
      clicks: toIntOrUndef(values[4]),
    });
    if (!parsed.success) {
      setErrorMsg(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    if (
      parsed.data.impressions === undefined &&
      parsed.data.likes === undefined &&
      parsed.data.comments === undefined &&
      parsed.data.shares === undefined &&
      parsed.data.clicks === undefined
    ) {
      setErrorMsg("Ingresa al menos una métrica");
      return;
    }
    setSaving(true);
    try {
      await recordMetric(id, platform, parsed.data);
      setValues(["", "", "", "", ""]);
      onChanged();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "No se pudo registrar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 border-t border-gray-100 dark:border-[#2d374e] pt-3">
      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400">
        Registrar snapshot (dueño/admin)
      </h3>
      {errorMsg !== "" && <p className="text-xs text-red-500 font-medium">{errorMsg}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {FIELD_NAMES.map((name, index) => (
          <input
            key={name}
            type="number"
            min={0}
            value={values[index] ?? ""}
            placeholder={name}
            onChange={(e) => {
              const nextValues = [...values];
              nextValues[index] = e.target.value;
              setValues(nextValues);
            }}
            className="rounded-[10px] border-[1.5px] border-[#ecedec] dark:border-slate-700 px-2.5 h-[40px] focus:outline-none focus:border-[#2d79f3] bg-transparent text-[#151717] dark:text-white text-xs w-full placeholder:text-gray-400 dark:placeholder:text-slate-300/80"
          />
        ))}
      </div>
      <div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void submit()}
          className="text-xs font-medium rounded-[10px] px-5 h-[38px] cursor-pointer bg-[#151717] text-white hover:bg-[#252727] disabled:opacity-50 transition-colors"
        >
          {saving ? "Registrando…" : "Registrar snapshot"}
        </button>
      </div>
    </div>
  );
}

function toIntOrUndef(value: string): number | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : Number(trimmed);
}
