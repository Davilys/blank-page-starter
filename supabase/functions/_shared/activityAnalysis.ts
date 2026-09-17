/** Strict, additive activity triage; unknown/missing results never become zero. */
export type ActivityGroup = 'related' | 'pending' | 'other';
export interface ActivityAnalysis {
  version: string;
  activity: string;
  focus_classes: number[];
  counts: Record<ActivityGroup, number>;
  items: { process: string; group: ActivityGroup; reason: string; specification: string | null }[];
  message: string;
  limitation: string;
}
export function normalizeActivityAnalysis(raw: unknown, processIds: string[]): ActivityAnalysis | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  const text = (v: unknown, max: number) => typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null;
  if (a.version !== 'wm-activity-filter-2026-09-17' || !Array.isArray(a.items) || !Array.isArray(a.focus_classes)) return null;
  const ids = new Set(processIds);
  if (ids.size !== processIds.length || a.items.length !== ids.size) return null;
  const seen = new Set<string>();
  const items: ActivityAnalysis['items'] = [];
  const counts = {related: 0, pending: 0, other: 0};
  for (const v of a.items) {
    if (!v || typeof v !== 'object') return null;
    const process = text(v.process, 9), reason = text(v.reason, 1000);
    if (!process || !/^\d{9}$/.test(process) || !ids.has(process) || seen.has(process) || !reason || !['related','pending','other'].includes(v.group)) return null;
    const specification = v.specification === null ? null : text(v.specification, 100000);
    if (v.group !== 'pending' && !specification) return null;
    seen.add(process);
    const group = v.group as ActivityGroup;
    counts[group]++;
    items.push({process, group, reason, specification});
  }
  if (!a.counts || typeof a.counts !== 'object') return null;
  for (const group of ['related','pending','other'] as const) if ((a.counts as Record<string,unknown>)[group] !== counts[group]) return null;
  const activity=text(a.activity,160), message=text(a.message,1000), limitation=text(a.limitation,2000);
  if (!activity || !message || !limitation || a.focus_classes.some(c=>!Number.isInteger(c)||c<1||c>45)) return null;
  return {version:a.version,activity,focus_classes:a.focus_classes,counts,items,message,limitation};
}
