"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { SESSION_EXPIRED_EVENT } from "@/lib/api";
import type { AuthUser } from "./schemas";
import { getMe } from "./api";

/**
 * Sesión de usuario en el cliente (solo lectura).
 *
 * Se alimenta de:
 * 1. Lo retornado por POST /auth/login y /auth/register ({ user }).
 * 2. GET /auth/me (sonda protegida del backend) si se recarga la página o se navega directamente.
 *
 * Se persiste en localStorage para evitar parpadeos y se mantiene sincronizado.
 */
const STORAGE_KEY = "postly-user";

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

function notify(): void {
  for (const listener of listeners) listener();
}

/** Guarda el usuario devuelto por `POST /auth/login`, `/auth/register` o `GET /auth/me`. */
export function saveSessionUser(user: AuthUser): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } catch {
      // Sin almacenamiento disponible.
    }
  }
  notify();
}

/** Limpia la sesión local (al cerrar sesión). */
export function clearSessionUser(): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Sin almacenamiento disponible.
    }
  }
  notify();
}

/**
 * La sesión dejó de ser válida en el servidor (refresh revocado o vencido).
 * El cliente HTTP lo avisa; aquí se limpia el usuario local y, si estaba en
 * el dashboard, se vuelve al login. Es un listener de módulo: `session.ts`
 * se importa en todos los componentes que muestran al usuario.
 */
if (typeof window !== "undefined") {
  window.addEventListener(SESSION_EXPIRED_EVENT, () => {
    clearSessionUser();
    if (window.location.pathname.startsWith("/dashboard")) {
      // URL absoluta a propósito: recarga completa para descartar estado
      // cliente de una sesión que el servidor ya no acepta.
      const loginUrl = new URL("/login", window.location.origin).toString();
      window.location.assign(loginUrl);
    }
  });
}

function parseUser(raw: string | null): AuthUser | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

/**
 * Suscribe un componente al usuario de la sesión.
 * Si no está en memoria/localStorage, consulta automáticamente GET /auth/me.
 */
export function useSessionUser(): AuthUser | null {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const user = useMemo(() => parseUser(raw), [raw]);

  useEffect(() => {
    // Si no tenemos usuario en localStorage pero el navegador tiene cookies de sesión,
    // sincronizar consultando GET /auth/me
    if (!user) {
      let isMounted = true;
      getMe()
        .then((me) => {
          if (!isMounted) return;
          saveSessionUser({ id: me.id, email: me.email, name: me.name, role: me.role });
        })
        .catch(() => {
          // Si el token es inválido o no hay cookie, no hacer nada
        });
      return () => {
        isMounted = false;
      };
    }
  }, [user]);

  return user;
}
