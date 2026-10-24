"use server";

import { cookies } from "next/headers";

/**
 * Fallback del logout: el backend ya revoca la sesión y borra las cookies al
 * responder `POST /auth/logout`. Si esa llamada falla por red, este server
 * action elimina igualmente las cookies HttpOnly para que el navegador no
 * quede con una sesión "fantasma" que el proxy seguiría aceptando.
 */
export async function clearAuthCookiesAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("accessToken");
  cookieStore.delete("refreshToken");
}
