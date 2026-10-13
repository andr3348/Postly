"use client";

import Image from "next/image";
import { useState } from "react";

interface BrandLogoProps {
  readonly name: string;
  readonly logoUrl: string | null;
}

/** Espejo del límite del backend: solo se renderizan URLs http(s). */
function isSafeUrl(value: string | null): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}

/**
 * Logo de la marca en mosaico neutro ÚNICO para ambos temas (cuadrícula
 * gris media tipo transparencia): un fondo claro se traga los logos blancos
 * y uno oscuro los logos oscuros; el tono medio delinea ambos extremos.
 * Si no hay logo o la imagen falla, muestra la inicial (mismo estilo que
 * el avatar de perfil).
 */
export function BrandLogo({ name, logoUrl }: BrandLogoProps) {
  const [failed, setFailed] = useState(false);
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  if (!isSafeUrl(logoUrl) || failed) {
    return (
      <span
        aria-hidden="true"
        className="w-14 h-14 rounded-xl bg-[#083A3D] dark:bg-[#394560] text-white flex items-center justify-center text-xl font-semibold shrink-0 select-none"
      >
        {initial}
      </span>
    );
  }

  return (
    <span className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-slate-500/60 bg-[repeating-conic-gradient(#7b8492_0%_25%,#a6afbb_0%_50%)] bg-[size:12px_12px]">
      <Image
        src={logoUrl.trim()}
        alt={`Logo de ${name}`}
        fill
        sizes="56px"
        unoptimized
        className="object-contain p-1 drop-shadow-[0_1px_1px_rgba(0,0,0,0.55)]"
        onError={() => setFailed(true)}
      />
    </span>
  );
}
