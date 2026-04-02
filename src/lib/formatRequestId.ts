/**
 * Shared request ID formatter.
 * Formats numeric IDs as zero-padded 5-digit strings: 00001, 00002, etc.
 * Keeps internal DB numeric ID unchanged — this is display-only.
 */
export function formatRequestId(id: number | string | null | undefined): string {
  if (id == null) return '—';
  const num = typeof id === 'string' ? parseInt(id, 10) : id;
  if (isNaN(num)) return String(id);
  return String(num).padStart(5, '0');
}
