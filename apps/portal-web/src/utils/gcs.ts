export function gcsColor(gcs: number | null): string {
  if (gcs == null) return "#9ca3af"
  if (gcs >= 8.5) return "#16a34a"
  if (gcs >= 7) return "#f97316"
  return "#dc2626"
}

export function isGoneQuiet(iso: string | null): boolean {
  if (!iso) return false
  return Date.now() - new Date(iso).getTime() > 7 * 24 * 60 * 60 * 1000
}
