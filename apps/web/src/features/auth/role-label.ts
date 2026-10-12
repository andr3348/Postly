import type { AuthUser } from "./schemas";

/** Etiqueta en español para cada rol del backend. */
export const ROLE_LABEL: Record<AuthUser["role"], string> = {
  ADMIN: "Administrador",
  MARKETING: "Marketing",
};
