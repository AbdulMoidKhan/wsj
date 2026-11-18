/*
 * In-memory stand-in for the subset of Prisma's Content API used by PublicController.
 * It evaluates the real `where` objects the controller builds (AND/OR, equality, null,
 * lte/gt on dates, case-insensitive contains, JSON path equals), plus orderBy, skip/take,
 * omit/select, count and aggregate(_min). Rows get their scheduling columns from
 * scheduleColumns(metadata), mirroring the content_schedule_sync database trigger.
 * No Prisma instance, database, environment or network is involved.
 */
import {scheduleColumns} from '../src/content-safety';

type Row = Record<string, any>;

function cmp(a: any, b: any) {
  const x = a instanceof Date ? a.getTime() : a, y = b instanceof Date ? b.getTime() : b;
  return x < y ? -1 : x > y ? 1 : 0;
}

export function matches(where: any, row: Row): boolean {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (key === 'AND') { if (!(cond as any[]).every(w => matches(w, row))) return false; continue; }
    if (key === 'OR') { if (!(cond as any[]).some(w => matches(w, row))) return false; continue; }
    const value = row[key];
    if (cond === null) { if (value !== null && value !== undefined) return false; continue; }
    if (cond instanceof Date || typeof cond !== 'object') { if (cmp(value, cond) !== 0) return false; continue; }
    const c = cond as any;
    if ('path' in c) { // JSON path equals
      let v: any = value; for (const seg of c.path) v = v && typeof v === 'object' ? v[seg] : undefined;
      if (v !== c.equals) return false; continue;
    }
    if ('contains' in c) {
      const hay = String(value ?? ''), needle = String(c.contains);
      if (!(c.mode === 'insensitive' ? hay.toLowerCase().includes(needle.toLowerCase()) : hay.includes(needle))) return false;
      continue;
    }
    if (value === null || value === undefined) return false; // SQL: comparisons with NULL are not true
    if ('lte' in c && !(cmp(value, c.lte) <= 0)) return false;
    if ('lt' in c && !(cmp(value, c.lt) < 0)) return false;
    if ('gte' in c && !(cmp(value, c.gte) >= 0)) return false;
    if ('gt' in c && !(cmp(value, c.gt) > 0)) return false;
  }
  return true;
}

function project(row: Row, args: any) {
  if (args?.select) return Object.fromEntries(Object.keys(args.select).filter(k => args.select[k]).map(k => [k, row[k]]));
  if (args?.omit) return Object.fromEntries(Object.entries(row).filter(([k]) => !args.omit[k]));
  return {...row};
}

export function withScheduleColumns<T extends Row>(row: T): T {
  return {...scheduleColumns(row.metadata), ...row};
}

/** Drop resource-kind clauses (top-level `kind` and kind-only `OR`) for fixtures whose rows share one kind. */
function withoutKind(where: any) {
  if (!where) return where;
  const {kind: _kind, ...rest} = where;
  if (Array.isArray(rest.OR) && rest.OR.every((w: any) => w && 'kind' in w)) delete rest.OR;
  return rest;
}

export function memoryContent(source: Row[], options: {ignoreKind?: boolean} = {}) {
  const rows = () => source.map(withScheduleColumns);
  const scope = (args: any = {}) => (options.ignoreKind ? {...args, where: withoutKind(args.where)} : args);
  const sorted = (list: Row[], orderBy: any[] = []) => [...list].sort((a, b) => {
    for (const o of orderBy) { const [k, dir] = Object.entries(o)[0] as [string, string]; const r = cmp(a[k], b[k]); if (r) return dir === 'desc' ? -r : r; }
    return 0;
  });
  return {
    async findMany(input: any = {}) {
      const args = scope(input);
      const list = sorted(rows().filter(r => matches(args.where, r)), args.orderBy);
      const start = args.skip ?? 0, end = args.take === undefined ? undefined : start + args.take;
      return list.slice(start, end).map(r => project(r, args));
    },
    async findFirst(input: any = {}) {
      const args = scope(input);
      const r = rows().find(x => matches(args.where, x));
      return r ? project(r, args) : null;
    },
    async count(input: any = {}) { const args = scope(input); return rows().filter(r => matches(args.where, r)).length; },
    async aggregate(input: any = {}) {
      const args = scope(input);
      const list = rows().filter(r => matches(args.where, r));
      const _min: Row = {};
      for (const f of Object.keys(args._min || {})) {
        const values = list.map(r => r[f]).filter(v => v !== null && v !== undefined).sort(cmp);
        _min[f] = values.length ? values[0] : null;
      }
      return {_min};
    },
  };
}
