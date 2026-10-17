/** Formatea fechas ISO del backend para la UI (fechas nulas = guión). */
export function formatDateTime(iso: string | null): string {
  if (iso === null) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}
