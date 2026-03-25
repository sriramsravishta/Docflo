import type {
  ConsultRow,
  ConsultSummary,
  DiagnosisSummary,
  TreatmentSummary,
  InvestigationsSummary,
  ConsultMedicineRow,
  SummaryMedication,
} from '../types/db';

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateShort(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatRecordingTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function safeJsonParse(value: unknown): unknown {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  if (!(t.startsWith('{') || t.startsWith('['))) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

export function normalizeTime(value: unknown): string[] {
  const out: string[] = [];

  const pushMany = (arr: unknown[]) => {
    arr.forEach((x) => {
      if (x === null || x === undefined) return;
      if (Array.isArray(x)) return pushMany(x);
      if (typeof x === 'string') {
        let s = x.trim();
        if (!s) return;
        if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
          s = s.slice(1, -1).trim();
        }
        if (s.startsWith('[') && s.endsWith(']')) {
          try {
            const parsed = JSON.parse(s);
            if (Array.isArray(parsed)) return pushMany(parsed);
          } catch {}
        }
        if (s.startsWith('{') && s.endsWith('}')) {
          const parts = s.slice(1, -1).split(',').map((p) => p.trim()).filter(Boolean);
          return pushMany(parts);
        }
        out.push(s);
        return;
      }
      out.push(String(x));
    });
  };

  if (Array.isArray(value)) pushMany(value);
  else pushMany([value]);

  const allowed = new Set(['Morning', 'Afternoon', 'Night', 'Not applicable']);
  return Array.from(new Set(out)).filter((x) => allowed.has(x));
}

export function getConsultSummary(consult: ConsultRow): ConsultSummary | null {
  const raw = consult?.consult_summary_final;
  if (!raw) return null;

  let obj: unknown = null;
  if (typeof raw === 'string') {
    obj = safeJsonParse(raw);
  } else if (typeof raw === 'object') {
    obj = raw;
  }

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  if (Object.keys(obj as object).length === 0) return null;

  return obj as ConsultSummary;
}

export function isConsultProcessed(consult: ConsultRow): boolean {
  const summary = getConsultSummary(consult);
  if (!summary) return false;
  if (typeof summary === 'object' && Object.keys(summary).length === 0) return false;
  return true;
}

export function isConsultError(consult: ConsultRow, uiNow: number): boolean {
  if (isConsultProcessed(consult)) return false;
  const elapsed = getElapsedSeconds(consult, uiNow);
  return elapsed > MAX_PROCESS_SECONDS;
}

export function getElapsedSeconds(item: { created_at?: string }, uiNow: number): number {
  const createdAt = item?.created_at ? new Date(item.created_at).getTime() : null;
  if (!createdAt || isNaN(createdAt)) return 0;
  return Math.max(0, Math.floor((uiNow - createdAt) / 1000));
}

export const ESTIMATED_PROCESS_SECONDS = 60;
export const MAX_PROCESS_SECONDS = 300;
export const PRE_CONSULT_ESTIMATED_SECONDS = 100;

export function getProgressPercent(consult: ConsultRow, uiNow: number): number {
  if (isConsultProcessed(consult)) return 100;
  if (isConsultError(consult, uiNow)) return 0;
  const elapsed = getElapsedSeconds(consult, uiNow);
  return Math.max(0, Math.min(99, Math.floor((elapsed / ESTIMATED_PROCESS_SECONDS) * 100)));
}

export function getConsultPreviewText(consult: ConsultRow): string {
  const summary = getConsultSummary(consult);
  if (!summary) return 'Consultation summary';
  if (typeof summary.diagnosis === 'string' && summary.diagnosis.trim()) return summary.diagnosis;
  if (summary.diagnosis && typeof summary.diagnosis === 'object') {
    const first = Array.isArray((summary.diagnosis as DiagnosisSummary).provisional)
      ? (summary.diagnosis as DiagnosisSummary).provisional![0]
      : null;
    if (first) return first;
  }
  if (Array.isArray(summary.chief_complaints) && summary.chief_complaints.length > 0) {
    return summary.chief_complaints[0];
  }
  if (typeof summary.history === 'string' && summary.history.trim()) return 'History available';
  return 'Consultation summary';
}

function bulletify(arr: unknown[]): string[] {
  return arr.map((x) => `- ${String(x ?? '').trim()}`).filter((l) => l.trim() !== '-');
}

function parseSectionBullets(lines: string[], startIdx: number): string[] {
  const items: string[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) continue;
    if (/^(provisional|key findings|immediate plan|contingent plan|notes|ordered)\s*:/i.test(l)) break;
    if (/^[-•*]\s+/.test(l)) items.push(l.replace(/^[-•*]\s+/, '').trim());
    else items.push(l);
  }
  return items.filter(Boolean);
}

export function diagnosisToEditableText(diagnosis: unknown): string {
  const parsed = safeJsonParse(diagnosis);
  const d = parsed ?? diagnosis;
  if (!d) return '';
  if (typeof d === 'string') return d;
  if (typeof d !== 'object' || Array.isArray(d)) return '';

  const dd = d as DiagnosisSummary;
  const prov = Array.isArray(dd.provisional) ? dd.provisional : [];
  const keyf = Array.isArray(dd.key_findings) ? dd.key_findings : [];

  const lines: string[] = [];
  if (prov.length) { lines.push('Provisional:'); lines.push(...bulletify(prov)); lines.push(''); }
  if (keyf.length) { lines.push('Key Findings:'); lines.push(...bulletify(keyf)); lines.push(''); }
  return lines.join('\n').trim();
}

export function diagnosisTextToJson(text: string, fallback: unknown): unknown {
  const raw = text.trim();
  if (!raw) return '';
  const lines = raw.split('\n').map((l) => l.trim());
  const provIdx = lines.findIndex((l) => /^provisional\s*:/i.test(l));
  const keyIdx = lines.findIndex((l) => /^key findings\s*:/i.test(l));
  const provisional = provIdx >= 0 ? parseSectionBullets(lines, provIdx + 1) : [];
  const key_findings = keyIdx >= 0 ? parseSectionBullets(lines, keyIdx + 1) : [];
  if (provisional.length || key_findings.length) {
    return { ...(provisional.length ? { provisional } : {}), ...(key_findings.length ? { key_findings } : {}) };
  }
  return raw;
}

export function treatmentToEditableText(treatment: unknown): string {
  const parsed = safeJsonParse(treatment);
  const t = parsed ?? treatment;
  if (!t) return '';
  if (typeof t === 'string') return t;
  if (typeof t !== 'object' || Array.isArray(t)) return '';

  const tt = t as TreatmentSummary;
  const immediate = Array.isArray(tt.immediate_plan) ? tt.immediate_plan : [];
  const contingent = Array.isArray(tt.contingent_plan) ? tt.contingent_plan : [];

  const lines: string[] = [];
  if (immediate.length) { lines.push('Immediate Plan:'); lines.push(...bulletify(immediate)); lines.push(''); }
  if (contingent.length) { lines.push('Contingent Plan:'); lines.push(...bulletify(contingent)); lines.push(''); }
  return lines.join('\n').trim();
}

export function treatmentTextToJson(text: string, fallback: unknown): unknown {
  const raw = text.trim();
  if (!raw) return '';
  const lines = raw.split('\n').map((l) => l.trim());
  const immIdx = lines.findIndex((l) => /^immediate plan\s*:/i.test(l));
  const conIdx = lines.findIndex((l) => /^contingent plan\s*:/i.test(l));
  const immediate_plan = immIdx >= 0 ? parseSectionBullets(lines, immIdx + 1) : [];
  const contingent_plan = conIdx >= 0 ? parseSectionBullets(lines, conIdx + 1) : [];
  if (immediate_plan.length || contingent_plan.length) {
    return { ...(immediate_plan.length ? { immediate_plan } : {}), ...(contingent_plan.length ? { contingent_plan } : {}) };
  }
  return raw;
}

export function investigationsToEditableText(investigations: unknown): string {
  const parsed = safeJsonParse(investigations);
  const inv = parsed ?? investigations;
  if (!inv) return '';
  if (typeof inv === 'string') return inv;
  if (typeof inv !== 'object' || Array.isArray(inv)) return '';

  const ii = inv as InvestigationsSummary;
  const ordered = Array.isArray(ii.ordered) ? ii.ordered : [];
  const notes = ii.notes ? String(ii.notes) : '';

  const lines: string[] = [];
if (ordered.length) {
  lines.push('Ordered:');
  ordered.forEach((o) => {
    const name = o?.name ? String(o.name) : '-';
    const b = o?.body_part_or_type ? ` — ${String(o.body_part_or_type)}` : '';
    const p = o?.priority ? ` (Priority: ${String(o.priority)})` : '';
    lines.push(`- ${name}${b}${p}`.trim());
  });
  lines.push('');
}
if (notes) { lines.push('Notes:'); lines.push(notes); lines.push(''); }
return lines.join('\n').trim();
}

export function investigationsTextToJson(text: string, fallback: unknown): unknown {
  const raw = text.trim();
  if (!raw) return '';
  const lines = raw.split('\n').map((l) => l.trim());
  const notesIdx = lines.findIndex((l) => /^notes\s*:/i.test(l));
  const ordIdx = lines.findIndex((l) => /^ordered\s*:/i.test(l));

  let notes = '';
  if (notesIdx >= 0) {
    const after = lines.slice(notesIdx + 1, ordIdx >= 0 ? ordIdx : lines.length).filter(Boolean);
    notes = after.join('\n').trim();
  }

  let ordered: { name: string; body_part_or_type?: string; priority?: string }[] = [];
  if (ordIdx >= 0) {
    const items = parseSectionBullets(lines, ordIdx + 1);
    ordered = items.map((item) => {
      let priority: string | undefined;
      const pr = item.match(/\(.*priority\s*:\s*([^)]+)\)/i);
      if (pr?.[1]) priority = pr[1].trim();
      const cleaned = item.replace(/\(.*priority\s*:\s*[^)]+\)/gi, '').trim();
      const parts = cleaned.split('—').map((p) => p.trim()).filter(Boolean);
      const name = parts[0] || cleaned;
      const body_part_or_type = parts.length > 1 ? parts.slice(1).join(' — ') : undefined;
      return { name, ...(body_part_or_type ? { body_part_or_type } : {}), ...(priority ? { priority } : {}) };
    }).filter((o) => o.name);
  }

  if (notes || ordered.length) {
    return { ...(notes ? { notes } : {}), ...(ordered.length ? { ordered } : {}) };
  }
  return raw;
}

export function getViewModeMedicines(
  summary: ConsultSummary | null,
  consultMedicines: ConsultMedicineRow[]
): ReturnType<typeof normalizeMedicineRow>[] {
  if (consultMedicines.length > 0) {
    return consultMedicines.map(normalizeMedicineRow);
  }
  if (Array.isArray(summary?.medications) && (summary!.medications as SummaryMedication[]).length > 0) {
    return (summary!.medications as SummaryMedication[]).map((m) => ({
      name: m?.drug_name || '',
      dosage: '',
      quantity: '',
      type: '',
      frequency: m?.frequency || '',
      time: [] as string[],
      food: '',
      duration: m?.duration_or_quantity || '',
      instructions: m?.indication || '',
      flags: '',
    }));
  }
  return [];
}

export function normalizeMedicineRow(m: ConsultMedicineRow) {
  return {
    name: m?.name || '',
    dosage: m?.dosage || '',
    quantity: m?.quantity || '',
    type: m?.type || '',
    frequency: m?.frequency || '',
    time: normalizeTime(m?.time),
    food: m?.food || '',
    duration: m?.duration || '',
    instructions: m?.instructions || '',
    flags: m?.flags || '',
  };
}

export function getInterpretationColor(interpretation: string): string {
  const t = (interpretation || '').toLowerCase();
  if (t.includes('normal') || t.includes('acceptable')) return '#10b981';
  if (t.includes('borderline')) return '#f59e0b';
  if (t.includes('high') || t.includes('critical') || t.includes('elevated')) return '#ef4444';
  if (t.includes('low')) return '#3b82f6';
  return '#6b7280';
}

export function escapeHtml(s: unknown): string {
  const str = String(s ?? '');
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function toHtmlList(items: unknown[]): string {
  return `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`;
}

export const FREQUENCY_OPTIONS = [
  '1x everyday', '2x everyday', '3x everyday',
  '1x week', '2x week', '3x week', '4x week',
];

export const FOOD_OPTIONS = ['Before food', 'After food', 'Not applicable'];

export const TIME_OPTIONS = ['Morning', 'Afternoon', 'Night', 'Not applicable'];
