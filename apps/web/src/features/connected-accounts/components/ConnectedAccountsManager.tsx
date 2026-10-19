"use client";

import { Suspense, use, useCallback, useState } from "react";
import {
  connectAccount,
  disconnectAccount,
  getAccountsCached,
  invalidateAccounts,
  type AccountPlatform,
  type ConnectedAccount,
  type ConnectAccountPayload,
} from "@/features/connected-accounts/api";
import { getBrandsCached } from "@/features/brands/api";
import { useBrand } from "@/features/brands/BrandContext";
import { ConnectAccountForm } from "@/features/connected-accounts/components/ConnectAccountForm";
import { Modal } from "@/shared/components/Modal";
import {
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  TiktokIcon,
} from "@/shared/components/icons/DashboardIcons";

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
  const { selectedId } = useBrand();
  const current = brands.find((brand) => brand.id === selectedId) ?? brands[0] ?? null;

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
    />
  );
}

function AccountsGrid({
  brandId,
  brandName,
  version,
  onChanged,
}: {
  brandId: string;
  brandName: string;
  version: number;
  onChanged: (brandId: string) => void;
}) {
  const accounts = use(getAccountsCached(brandId, version));
  const [connecting, setConnecting] = useState<AccountPlatform | null>(null);
  const [confirming, setConfirming] = useState<AccountPlatform | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const closeModal = useCallback(() => setConnecting(null), []);

  const byPlatform = new Map<AccountPlatform, ConnectedAccount>();
  for (const account of accounts) byPlatform.set(account.platform, account);

  const connectingAccount =
    connecting === null ? null : (byPlatform.get(connecting) ?? null);

  const handleConnect = async (data: ConnectAccountPayload) => {
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

  return (
    <div className="flex flex-col gap-5 pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-[#083A3D] dark:text-white">
            Cuentas conectadas
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Marca: {brandName} · tokens manuales con prueba real antes de guardar
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
            onSubmit={handleConnect}
            onCancel={closeModal}
          />
        )}
      </Modal>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {PLATFORMS.map(({ platform, label }) => {
          const account = byPlatform.get(platform);
          const Icon = iconOf(platform);
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
              <div className="flex gap-2 mt-1 flex-wrap">
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
                  Token vencido: actualiza la cuenta para re-autenticar.
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
