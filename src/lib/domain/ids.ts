/** Short random id with a readable prefix, e.g. "ms_k3j9x2a1". */
export function newId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}`;
}
