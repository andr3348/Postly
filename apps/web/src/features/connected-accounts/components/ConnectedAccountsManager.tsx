"use client";

import { Suspense, use, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  completeMetaOAuth,
  connectAccount,
  connectInstagramFromFacebook,
  disconnectAccount,
  getAccountsCached,
  getMetaOAuthSession,
  invalidateAccounts,
  startMetaOAuth,
  type AccountPlatform,
  type ConnectedAccount,
  type ConnectAccountPayload,
  type MetaOAuthSession,
} from "@/features/connected-accounts/api";
import { getBrandsCached } from "@/features/brands/api";
import { useBrand } from "@/features/brands/BrandContext";
import { ConnectAccountForm } from "@/features/connected-accounts/components/ConnectAccountForm";
import { MetaPagePicker } from "@/features/connected-accounts/components/MetaPagePicker";
import { Modal } from "@/shared/components/Modal";
import {
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  TiktokIcon,
} from "@/shared/components/icons/DashboardIcons";

const ACCOUNTS_PATH = "/dashboard/accounts";

const PLATFORMS: ReadonlyArray<{
  readonly platform: AccountPlatform;
  readonly label: string;
}> = [
  { platform: "FACEBOOK", label: "Facebook" },
  { platform: "INSTAGRAM", label: "Instagram" },
  { platform: "LINKEDIN", label: "LinkedIn" },
  { platform: "TIKTOK", label: "TikTok" },
];

export function ConnectedAccountsManager() {
  const [version, setVersion] = useState(0);

  const refresh = useCallback((brandId: string) => {
    invalidateAccounts(brandId);
    setVersion((current) => current + 1);
  }, []);

  return (
    <Suspense
      fallback={
        <div className="bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] p-8 shadow-xs text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Cargando cuentas…</p>
        </div>
      }
    >
      <ManagerInner key={version} version={version} onChanged={refresh} />
    </Suspense>
  );
}

function ManagerInner({
  version,
  onChanged,
}: {
  version: number;
  onChanged: (brandId: string) => void;
}) {
  const { brands } = use(getBrandsCached());
  const { selectedId, select } = useBrand();
  const searchParams = useSearchParams();
  const metaSessionId = searchParams.get("meta_session");
  const metaBrandId = searchParams.get("meta_brand");
  const metaError = searchParams.get("meta_error");

  // El callback de Meta regresa con la marca que inició el flujo: tiene
  // prioridad sobre la selección actual para no abrir la sesión en otra marca.
  const brandFromMeta =
    metaBrandId !== null && brands.some((brand) => brand.id === metaBrandId)
      ? metaBrandId
      : null;
  const current =
    brands.find((brand) => brand.id === (brandFromMeta ?? selectedId)) ??
    brands[0] ??
    null;

  useEffect(() => {
    if (brandFromMeta !== null && brandFromMeta !== selectedId) {
      select(brandFromMeta);
    }
  }, [brandFromMeta, selectedId, select]);

  if (current === null) {
    return (
      <div className="bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] p-8 shadow-xs text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Sin marcas todavía. Crea una marca antes de conectar cuentas.
        </p>
      </div>
    );
  }

  return (
    <AccountsGrid
      key={`${current.id}-${version}`}
      brandId={current.id}
      brandName={current.name}
      version={version}
      onChanged={onChanged}
      metaSessionId={metaSessionId}
      metaError={metaError}
    />
  );
}

function AccountsGrid({
  brandId,
  brandName,
  version,
  onChanged,
  metaSessionId,
  metaError,
}: {
  brandId: string;
  brandName: string;
  version: number;
  onChanged: (brandId: string) => void;
  metaSessionId: string | null;
  metaError: string | null;
}) {
  const accounts = use(getAccountsCached(brandId, version));
  const router = useRouter();
  const [connecting, setConnecting] = useState<AccountPlatform | null>(null);
  const [confirming, setConfirming] = useState<AccountPlatform | null>(null);
  // Si el callback no pudo asociar sesión, el error llega por query; se
  // captura al montar para que persista cuando el effect limpie la URL.
  const [errorMsg, setErrorMsg] = useState(() =>
    metaError !== null ? metaErrorFromParam(metaError) : "",
  );
  const [metaBusy, setMetaBusy] = useState<AccountPlatform | null>(null);
  const [pagePicker, setPagePicker] = useState<MetaOAuthSession | null>(null);

  // Retorno de facebook.com: la sesión llega por query y se resuelve una vez.
  useEffect(() => {
    if (metaSessionId === null || metaSessionId === "") return;
    let cancelled = false;
    getMetaOAuthSession(brandId, metaSessionId)
      .then((session) => {
        if (cancelled) return;
        if (session.status === "READY") {
          setPagePicker(session);
        } else {
          setErrorMsg(
            session.errorMessage ?? "No se pudo completar la conexión con Meta.",
          );
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setErrorMsg(
          err instanceof Error ? err.message : "No se pudo completar la conexión con Meta.",
        );
      })
      .finally(() => {
        if (!cancelled) router.replace(ACCOUNTS_PATH);
      });
    return () => {
      cancelled = true;
    };
  }, [metaSessionId, brandId, router]);

  // State inválido o vencido: el mensaje ya quedó en estado al montar; el
  // effect solo limpia la query para que un refresh no lo repita.
  useEffect(() => {
    if (metaError === null) return;
    router.replace(ACCOUNTS_PATH);
  }, [metaError, router]);

  const closeModal = useCallback(() => setConnecting(null), []);

  const byPlatform = new Map<AccountPlatform, ConnectedAccount>();
  for (const account of accounts) byPlatform.set(account.platform, account);

  const facebook = byPlatform.get("FACEBOOK") ?? null;
  const facebookReady = facebook !== null && facebook.status !== "DISCONNECTED";
  const connectingAccount =
    connecting === null ? null : (byPlatform.get(connecting) ?? null);
  const connectingIsMeta = connecting === "FACEBOOK" || connecting === "INSTAGRAM";

  const handleManualConnect = async (data: ConnectAccountPayload) => {
    await connectAccount(brandId, data);
    setConnecting(null);
    setConfirming(null);
    onChanged(brandId);
  };

  const handleDisconnect = async (platform: AccountPlatform) => {
    setErrorMsg("");
    try {
      await disconnectAccount(brandId, platform);
      setConfirming(null);
      onChanged(brandId);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "No se pudo desvincular");
    }
  };

  const handleFacebookOAuth = async () => {
    setErrorMsg("");
    setMetaBusy("FACEBOOK");
    try {
      const { authorizationUrl } = await startMetaOAuth(brandId);
      // Salida completa a facebook.com: no es una llamada fetch.
      window.location.assign(authorizationUrl);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "No se pudo iniciar la conexión con Meta",
      );
      setMetaBusy(null);
    }
  };

  const handleInstagramFromFacebook = async () => {
    setErrorMsg("");
    setMetaBusy("INSTAGRAM");
    try {
      await connectInstagramFromFacebook(brandId);
      onChanged(brandId);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "No se pudo conectar Instagram");
      setMetaBusy(null);
    }
  };

  const handleCompleteMetaPage = async (pageId: string) => {
    if (pagePicker === null) return;
    await completeMetaOAuth(brandId, pagePicker.id, pageId);
    setPagePicker(null);
    onChanged(brandId);
  };

  return (
    <div className="flex flex-col gap-5 pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-[#083A3D] dark:text-white">
            Cuentas conectadas
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Marca: {brandName} · Meta con OAuth; LinkedIn y TikTok con token verificado
          </p>
        </div>
      </div>

      {errorMsg !== "" && (
        <p className="text-sm text-red-500 font-medium">{errorMsg}</p>
      )}

      <Modal
        title={
          connecting === null
            ? "Conectar cuenta"
            : connectingIsMeta
              ? `Token manual · ${labelOf(connecting)}`
              : `${connectingAccount ? "Actualizar" : "Conectar"} ${labelOf(connecting)}`
        }
        open={connecting !== null}
        onClose={closeModal}
      >
        {connecting !== null && (
          <ConnectAccountForm
            key={connecting}
            brandId={brandId}
            platform={connecting}
            initial={
              connectingAccount
                ? {
                    accountName: connectingAccount.accountName,
                    externalAccountId: connectingAccount.externalAccountId ?? "",
                  }
                : undefined
            }
            submitLabel={connectingAccount ? "Guardar cambios" : "Guardar conexión"}
            onSubmit={handleManualConnect}
            onCancel={closeModal}
          />
        )}
      </Modal>

      <Modal
        title="Elegir página de Facebook"
        open={pagePicker !== null}
        onClose={() => setPagePicker(null)}
      >
        {pagePicker !== null && (
          <MetaPagePicker
            session={pagePicker}
            onSubmit={handleCompleteMetaPage}
            onCancel={() => setPagePicker(null)}
          />
        )}
      </Modal>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {PLATFORMS.map(({ platform, label }) => {
          const account = byPlatform.get(platform);
          const Icon = iconOf(platform);
          const isInstagram = platform === "INSTAGRAM";
          const instagramBlocked = isInstagram && !facebookReady;
          const busy = metaBusy === platform;

          return (
            <article
              key={platform}
              className="bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] p-6 shadow-xs flex flex-col gap-3"
            >
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-slate-800 flex items-center justify-center shrink-0">
                  <Icon className="w-6 h-6" />
                </span>
                <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-[#083A3D] dark:text-white">
                    {label}
                  </h2>
                  <StatusBadge status={account?.status ?? null} />
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {account
                  ? `${account.accountName}${account.externalAccountId ? ` · ${account.externalAccountId}` : ""}`
                  : "Sin vincular en esta marca."}
              </p>

              {platform === "FACEBOOK" && (
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {account
                    ? "Vuelve a conectar para renovar el Page token de Meta."
                    : "Inicia sesión con Meta y elige la página (OAuth)."}
                </p>
              )}
              {isInstagram && (
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {instagramBlocked
                    ? "Depende de Facebook: conecta primero la página para habilitar Instagram."
                    : "Meta requiere que la página de Facebook y la cuenta de Instagram estén vinculadas."}
                </p>
              )}
              {account?.authType === "META_OAUTH" && (
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  Vinculada con OAuth de Meta.
                </p>
              )}

              <div className="flex gap-2 mt-1 flex-wrap">
                {platform === "FACEBOOK" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleFacebookOAuth()}
                      disabled={busy}
                      className="bg-[#151717] text-white text-xs font-medium rounded-[10px] px-4 h-[36px] cursor-pointer hover:bg-[#252727] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {busy ? "Redirigiendo…" : account ? "Reconectar" : "Conectar Facebook"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConnecting(platform);
                        setConfirming(null);
                      }}
                      className="text-xs font-medium rounded-[10px] px-4 h-[36px] cursor-pointer text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#2d374e] transition-colors border border-gray-200 dark:border-[#2d374e]"
                    >
                      Token manual
                    </button>
                  </>
                ) : isInstagram ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleInstagramFromFacebook()}
                      disabled={instagramBlocked || busy}
                      title={
                        instagramBlocked
                          ? "Conecta primero la página de Facebook"
                          : undefined
                      }
                      className="bg-[#151717] text-white text-xs font-medium rounded-[10px] px-4 h-[36px] cursor-pointer hover:bg-[#252727] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {busy ? "Detectando…" : account ? "Reconectar" : "Conectar Instagram"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConnecting(platform);
                        setConfirming(null);
                      }}
                      className="text-xs font-medium rounded-[10px] px-4 h-[36px] cursor-pointer text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#2d374e] transition-colors border border-gray-200 dark:border-[#2d374e]"
                    >
                      Token manual
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setConnecting(platform);
                      setConfirming(null);
                    }}
                    className="text-xs font-medium rounded-[10px] px-4 h-[36px] cursor-pointer text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#2d374e] transition-colors border border-gray-200 dark:border-[#2d374e]"
                  >
                    {account ? "Actualizar" : "Conectar"}
                  </button>
                )}

                {account && confirming === platform ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleDisconnect(platform)}
                      className="text-xs font-medium rounded-[10px] px-4 h-[36px] cursor-pointer bg-red-600 text-white hover:bg-red-700 transition-colors"
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      className="text-xs font-medium rounded-[10px] px-4 h-[36px] cursor-pointer text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#2d374e] transition-colors"
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  account && (
                    <button
                      type="button"
                      onClick={() => {
                        setConfirming(platform);
                        setConnecting(null);
                      }}
                      className="text-xs font-medium rounded-[10px] px-4 h-[36px] cursor-pointer text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                    >
                      Desvincular
                    </button>
                  )
                )}
              </div>

              {account?.status === "EXPIRED" && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  {platform === "INSTAGRAM"
                    ? "Conexión vencida: vuelve a conectar Facebook."
                    : "Token vencido: vuelve a conectar para re-autenticar."}
                </p>
              )}
              {platform === "FACEBOOK" &&
                account?.status !== "EXPIRED" &&
                confirming === "FACEBOOK" && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                    Al desvincular Facebook también se desvincula Instagram.
                  </p>
                )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ConnectedAccount["status"] | null }) {
  if (status === "CONNECTED") {
    return (
      <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 px-2.5 py-1 rounded-full shrink-0">
        Conectada
      </span>
    );
  }
  if (status === "EXPIRED") {
    return (
      <span className="text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 px-2.5 py-1 rounded-full shrink-0">
        Vencida
      </span>
    );
  }
  if (status === "DISCONNECTED") {
    return (
      <span className="text-[11px] font-semibold bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300 px-2.5 py-1 rounded-full shrink-0">
        Desvinculada
      </span>
    );
  }
  return (
    <span className="text-[11px] font-semibold bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-gray-400 px-2.5 py-1 rounded-full shrink-0">
      Sin vincular
    </span>
  );
}

function labelOf(platform: AccountPlatform): string {
  return PLATFORMS.find((entry) => entry.platform === platform)?.label ?? platform;
}

function iconOf(platform: AccountPlatform) {
  switch (platform) {
    case "FACEBOOK":
      return FacebookIcon;
    case "INSTAGRAM":
      return InstagramIcon;
    case "LINKEDIN":
      return LinkedinIcon;
    case "TIKTOK":
      return TiktokIcon;
  }
}

/** Errores de Meta que no traen sesión (state inválido o vencido). */
function metaErrorFromParam(code: string): string {
  if (code === "invalid_state") {
    return "La conexión con Meta no es válida o ya se usó. Inténtalo de nuevo.";
  }
  if (code === "expired") {
    return "La conexión con Meta expiró. Inténtalo de nuevo.";
  }
  return "No se pudo completar la conexión con Meta. Inténtalo de nuevo.";
}
