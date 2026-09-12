// Reject ambiguous dictated amounts instead of silently changing their value.
export function voiceValue(current: string, transcript: string, type: string, start: number | null, end: number | null): string | null {
  const normalized = transcript.replace(/[०-९]/g, c => String(c.charCodeAt(0) - 0x0966)).trim();
  if (type === "number") {
    if (normalized.includes(",") && !/^-?\d{1,3}(,\d{3})+(\.\d+)?\.?$/.test(normalized) && !/^-?\d{1,2}(,\d{2})*,\d{3}(\.\d+)?\.?$/.test(normalized)) return null;
    const value = normalized.replace(/,/g, "").replace(/\.$/, "");
    return /^-?\d+(\.\d+)?$/.test(value) && Number.isFinite(Number(value)) ? value : null;
  }
  if (type === "date") return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
  if (type === "tel") return /^\+?[\d\s()-]+$/.test(normalized) ? normalized.replace(/[\s()-]/g, "") : null;
  if (type === "email" || type === "url") return normalized.replace(/\s/g, "");
  const a = start ?? current.length, b = end ?? a;
  const left = current.slice(0, a), right = current.slice(b);
  return left + (left && !/\s$/.test(left) ? " " : "") + transcript + (right && !/^\s/.test(right) ? " " : "") + right;
}
