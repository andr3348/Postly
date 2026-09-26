"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function logoutAction() {
  const cookieStore = await cookies();
  
  // Eliminamos las cookies HttpOnly desde el servidor de Next.js
  cookieStore.delete("accessToken");
  cookieStore.delete("refreshToken");

  redirect("/login");
}
