"use client";

import { useState } from "react";
import { verifyAccount, type AccountPlatform, type ConnectAccountPayload } from "@/features/connected-accounts/api";
import {
  connectAccountFormSchema,
  type ConnectAccountFormInput,
} from "@/features/connected-accounts/schemas";

interface ConnectAccountFormProps {
  readonly brandId: string;
  readonly platform: AccountPlatform;
  readonly initial?: Partial<Pick<ConnectAccountFormInput, "accountName" | "externalAccountId">>;
  readonly submitLabel: string;
  onSubmit(data: ConnectAccountPayload): Promise<void>;
  readonly onCancel?: () => void;
}

type VerifyState =
  | { readonly status: "idle" }
  | { readonly status: "verifying" }
  | { readonly status: "ok"; readonly displayName: string | null }
  | { readonly status: "error"; readonly message: string };

const META_NOTE =
  "Facebook e Instagram comparten el mismo Page access token de Meta, pero con IDs distintos: Page ID para Facebook, IG Professional ID para Instagram.";

/**
 * Formulario conectar/actualizar cuenta (tokens manuales + prueba real).
 * El guardado exige verificación exitosa contra el proveedor.
 */
export function ConnectAccountForm({
  brandId,
  platform,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: ConnectAccountFormProps) {
  const [accountName, setAccountName] = useState(initial?.accountName ?? "");
  const [externalAccountId, setExternalAccountId] = useState(initial?.externalAccountId ?? "");
  const [accessToken, setAccessToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [scope, setScope] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [verify, setVerify] = useState<VerifyState>({ status: "idle" });

  const meta = PLATFORM_META[platform];

  const touchVerify = () => {
    if (verify.status !== "idle") setVerify({ status: "idle" });
  };

  const handleVerify = async () => {
    setErrorMsg("");
    const trimmedId = externalAccountId.trim();
    const trimmedToken = accessToken.trim();
    if (trimmedId === "" || trimmedToken === "") {
      setErrorMsg("Completa el ID de cuenta y el token antes de verificar");
      return;
    }
    setVerify({ status: "verifying" });
    try {
      const result = await verifyAccount(brandId, {
        platform,
        externalAccountId: trimmedId,
        accessToken: trimmedToken,
      });
      setVerify({ status: "ok", displayName: result.displayName });
    } catch (err: unknown) {
      setVerify({
        status: "error",
        message: err instanceof Error ? err.message : "No se pudo verificar",
      });
    }
  };

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const parsed = connectAccountFormSchema.safeParse({
      platform,
      accountName,
      externalAccountId,
      accessToken: accessToken.trim() === "" ? "" : accessToken.trim(),
      refreshToken: emptyToUndefined(refreshToken.trim()),
      expiresAt: expiresAt === "" ? undefined : toIsoOrKeep(expiresAt),
      scope: emptyToUndefined(scope.trim()),
    });
    if (!parsed.success) {
      setErrorMsg(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        platform: parsed.data.platform,
        accountName: parsed.data.accountName,
        externalAccountId: parsed.data.externalAccountId,
        accessToken: parsed.data.accessToken,
        refreshToken: parsed.data.refreshToken,
        expiresAt: parsed.data.expiresAt,
        scope: parsed.data.scope,
      });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const verified = verify.status === "ok";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {(platform === "FACEBOOK" || platform === "INSTAGRAM") && (
        <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-[#2d374e] rounded-[10px] px-3 py-2">
          {META_NOTE}
        </p>
      )}
      {errorMsg !== "" && (
        <p className="text-red-500 text-sm text-center font-medium">{errorMsg}</p>
      )}
      <Field label="Nombre visible">
        <input
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          placeholder={meta.namePlaceholder}
          required
          className={inputClass}
        />
      </Field>
      <Field label={meta.idLabel}>
        <input
          value={externalAccountId}
          onChange={(e) => {
            setExternalAccountId(e.target.value);
            touchVerify();
          }}
          placeholder={meta.idPlaceholder}
          required
          className={inputClass}
        />
        <span className="text-[11px] text-gray-500 dark:text-gray-400">{meta.idHint}</span>
      </Field>
      <Field label="Access token">
        <input
          value={accessToken}
          onChange={(e) => {
            setAccessToken(e.target.value);
            touchVerify();
          }}
          placeholder="Pega el token…"
          required
          type="password"
          autoComplete="off"
          spellCheck={false}
          className={inputClass}
        />
        <span className="text-[11px] text-gray-500 dark:text-gray-400">{meta.tokenHint}</span>
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Refresh token (opcional)">
          <input
            value={refreshToken}
            onChange={(e) => setRefreshToken(e.target.value)}
            placeholder="Solo si el proveedor lo entrega"
            type="password"
            autoComplete="off"
            spellCheck={false}
            className={inputClass}
          />
        </Field>
        <Field label="Expira (opcional)">
          <input
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            type="datetime-local"
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Scope (opcional)">
        <input
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          placeholder="Permisos concedidos al token"
          className={inputClass}
        />
      </Field>

      <div className="flex flex-col gap-2 border-t border-gray-100 dark:border-[#2d374e] pt-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleVerify}
            disabled={verify.status === "verifying"}
            className="text-xs font-medium rounded-[10px] px-4 h-[36px] cursor-pointer text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#2d374e] transition-colors disabled:opacity-50 border border-gray-200 dark:border-[#2d374e]"
          >
            {verify.status === "verifying" ? "Verificando…" : "Probar conexión"}
          </button>
          {verify.status === "ok" && (
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Conexión verificada{verify.displayName ? `: ${verify.displayName}` : ""}
            </p>
          )}
          {verify.status === "error" && (
            <p className="text-xs font-medium text-red-500">{verify.message}</p>
          )}
        </div>
        {!verified && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Verifica contra {meta.provider} antes de guardar: no se almacena nada sin prueba exitosa.
          </p>
        )}
      </div>

      <div className="flex gap-2.5 mt-1">
        <button
          type="submit"
          disabled={saving || !verified}
          title={verified ? undefined : "Primero prueba la conexión"}
          className="bg-[#151717] text-white text-sm font-medium rounded-[10px] px-6 h-[44px] cursor-pointer hover:bg-[#252727] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Guardando…" : submitLabel}
        </button>
        {onCancel !== undefined && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-medium rounded-[10px] px-6 h-[44px] cursor-pointer text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#2d374e] transition-colors duration-200"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

const PLATFORM_META: Record<
  AccountPlatform,
  {
    readonly provider: string;
    readonly idLabel: string;
    readonly idPlaceholder: string;
    readonly idHint: string;
    readonly namePlaceholder: string;
    readonly tokenHint: string;
  }
> = {
  FACEBOOK: {
    provider: "Meta",
    idLabel: "Page ID",
    idPlaceholder: "Ej. 123456789012345",
    idHint: "ID numérico de la Fan Page.",
    namePlaceholder: "Ej. Alma Quinta",
    tokenHint: "Page access token con pages_manage_posts. También sirve para Instagram.",
  },
  INSTAGRAM: {
    provider: "Meta",
    idLabel: "IG Professional ID",
    idPlaceholder: "Ej. 17841400008460056",
    idHint: "Cuenta profesional vinculada a la Page. Usa el mismo Page token de Facebook.",
    namePlaceholder: "Ej. almaquintaoficial",
    tokenHint: "El mismo Page access token de Facebook (permisos instagram_basic + instagram_content_publish).",
  },
  LINKEDIN: {
    provider: "LinkedIn",
    idLabel: "Organization URN",
    idPlaceholder: "Ej. urn:li:organization:123456",
    idHint: "URN de la organización. La prueba valida el token de miembro/organización.",
    namePlaceholder: "Ej. Alma Quinta",
    tokenHint: "Token con w_organization_social para publicar como organización.",
  },
  TIKTOK: {
    provider: "TikTok",
    idLabel: "Open ID",
    idPlaceholder: "Ej. !IAx…",
    idHint: "open_id de la cuenta autorizada.",
    namePlaceholder: "Ej. almaquintaoficial",
    tokenHint: "Token de TikTok Login Kit con video.upload.",
  },
};

function emptyToUndefined(value: string): string | undefined {
  return value === "" ? undefined : value;
}

/** `datetime-local` entrega `YYYY-MM-DDTHH:mm`: el backend espera ISO con zona. */
function toIsoOrKeep(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[#151717] dark:text-gray-200 font-semibold text-sm">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "rounded-[10px] border-[1.5px] border-[#ecedec] dark:border-slate-700 px-3 h-[46px] focus:outline-none focus:border-[#2d79f3] bg-transparent text-[#151717] dark:text-white text-sm w-full placeholder:text-gray-400 dark:placeholder:text-slate-300/80";
