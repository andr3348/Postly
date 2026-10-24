"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  listAuthSessions,
  revokeAuthSession,
  revokeOtherAuthSessions,
  type AuthSessionView,
} from "@/features/auth/api";
import { clearSessionUser } from "@/features/auth/session";

/** Nombre legible del dispositivo a partir del User-Agent guardado al login. */
function deviceLabel(userAgent: string | null): string {
  if (!userAgent) return "Dispositivo desconocido";

  const browser = /Edg\//i.test(userAgent)
    ? "Edge"
    : /OPR\//i.test(userAgent)
      ? "Opera"
      : /Firefox\//i.test(userAgent)
        ? "Firefox"
        : /Chrome\//i.test(userAgent)
          ? "Chrome"
          : /Safari\//i.test(userAgent)
            ? "Safari"
            : "Navegador";

  const system = /iPhone|iPad|iPod/i.test(userAgent)
    ? "iOS"
    : /Android/i.test(userAgent)
      ? "Android"
      : /Windows/i.test(userAgent)
        ? "Windows"
        : /Macintosh|Mac OS X/i.test(userAgent)
          ? "macOS"
          : /Linux/i.test(userAgent)
            ? "Linux"
            : null;

  return system ? `${browser} · ${system}` : browser;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function DeviceIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" />
    </svg>
  );
}

/**
 * Multisesión: lista las sesiones activas del usuario (una por dispositivo
 * o navegador) y permite revocarlas. La revocación es inmediata porque el
 * guard del backend valida el `sid` del access JWT contra la BD.
 */
export function SessionsCard() {
  const router = useRouter();
  const [sessions, setSessions] = useState<AuthSessionView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [closingOthers, setClosingOthers] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listAuthSessions()
      .then((items) => {
        if (!cancelled) {
          setSessions(items);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudieron cargar las sesiones",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const retry = () => {
    setError(null);
    setSessions(null);
    setReloadKey((key) => key + 1);
  };

  const others = sessions?.filter((session) => !session.current) ?? [];

  const handleRevoke = async (session: AuthSessionView) => {
    setBusyId(session.id);
    setError(null);
    try {
      await revokeAuthSession(session.id);
      if (session.current) {
        // El backend ya borró las cookies; cerramos también el estado local.
        clearSessionUser();
        router.push("/login");
        router.refresh();
        return;
      }
      setSessions((previous) =>
        previous?.filter((item) => item.id !== session.id) ?? null,
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo cerrar la sesión");
    } finally {
      setBusyId(null);
    }
  };

  const handleRevokeOthers = async () => {
    setClosingOthers(true);
    setError(null);
    try {
      await revokeOtherAuthSessions();
      setSessions((previous) =>
        previous?.filter((session) => session.current) ?? null,
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cerrar las otras sesiones",
      );
    } finally {
      setClosingOthers(false);
    }
  };

  return (
    <section className="bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] p-6 sm:p-8 shadow-xs transition-colors duration-200">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-[#083A3D] dark:text-white">
            Sesiones activas
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Cada inicio de sesión crea una sesión independiente. Si ves un
            dispositivo que no reconoces, ciérralo y cambia tu contraseña.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRevokeOthers}
          disabled={closingOthers || others.length === 0}
          className="shrink-0 rounded-xl border border-red-200 dark:border-red-900/60 px-3.5 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {closingOthers ? "Cerrando..." : "Cerrar todas las demás"}
        </button>
      </div>

      {error && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 px-4 py-3">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button
            type="button"
            onClick={retry}
            className="text-xs font-semibold text-red-700 dark:text-red-300 hover:underline cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      )}

      {sessions === null && error === null && (
        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
          Cargando sesiones…
        </p>
      )}

      {sessions !== null && (
        <ul className="mt-6 flex flex-col divide-y divide-gray-100 dark:divide-slate-800">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="flex items-start gap-4 py-4 first:pt-0 last:pb-0"
            >
              <span className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-[#2c364d] text-[#083A3D] dark:text-gray-200 flex items-center justify-center shrink-0">
                <DeviceIcon className="w-5 h-5" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                    {deviceLabel(session.userAgent)}
                  </p>
                  {session.current && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Esta sesión
                    </span>
                  )}
                  {session.persistent && (
                    <span className="rounded-full bg-[#083A3D]/10 dark:bg-[#7387b3]/20 px-2.5 py-0.5 text-[11px] font-medium text-[#083A3D] dark:text-[#c7d2fe]">
                      Recordada
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  Última actividad: {formatDate(session.lastUsedAt)}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Inició: {formatDate(session.createdAt)} · IP:{" "}
                  {session.ip ?? "desconocida"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => void handleRevoke(session)}
                disabled={busyId === session.id}
                title="Cerrar esta sesión"
                aria-label={`Cerrar sesión de ${deviceLabel(session.userAgent)}`}
                className="shrink-0 rounded-lg p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-40 cursor-pointer"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
