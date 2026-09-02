import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  normalizeTime,
  escapeHtml,
  toHtmlList,
} from '../lib/utils';
import type { DiagnosisSummary, TreatmentSummary, InvestigationsSummary } from '../types/db';

function formatDate(s: string) {
  try {
    return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return s;
  }
}

const PRES_CSS = `
.pres-wrapper{border:1.5px solid #111;margin:0;padding:0;background:#fff;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#111}
.pt-info{padding:14px 16px 12px 16px;border-bottom:1px solid #ccc}
.pt-row{display:grid;grid-template-columns:1fr 1fr;gap:4px 32px;margin-bottom:2px}
.pt-name{font-size:16px;font-weight:700;text-transform:uppercase;color:#111;margin:0 0 4px 0}
.pt-meta{font-size:13px;color:#333}
.pt-label{font-weight:400;color:#555}
.pt-val{font-weight:400;color:#111}
.pt-date-val{font-weight:700;color:#111}
.section{margin:0;padding:12px 16px 12px 16px;border-bottom:1px solid #ccc}
.section:last-child{border-bottom:none}
.section-header{font-size:14px;font-weight:700;color:#111;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.02em}
.section-text{margin:4px 0;font-size:14px;color:#222}
.sub-label{font-size:12px;font-weight:700;color:#444;margin:8px 0 4px 0;text-transform:uppercase;letter-spacing:0.03em}
.section ul,.section-list{margin:4px 0 4px 18px;padding:0;list-style:disc}
.section ul li,.section-list li{font-size:14px;margin-bottom:3px;color:#222}
.inv-priority{font-size:12px;color:#666;font-style:italic}
.med-table{width:100%;border-collapse:collapse;margin-top:6px;font-size:13px}
.med-table thead tr{background:#f3f4f6}
.med-table th{text-align:left;padding:7px 8px;font-size:12px;font-weight:700;border:1px solid #d1d5db;color:#333}
.med-table td{padding:7px 8px;border:1px solid #d1d5db;vertical-align:top;color:#222}
.th-num,.td-num{width:28px;text-align:center}
.th-man,.td-man{width:90px;text-align:center}
.th-dur,.td-dur{width:80px}
.th-detail,.td-detail{width:140px}
.td-name strong{font-size:13px;font-weight:700}
.med-sub{font-size:12px;color:#555;margin-top:2px}
.med-instruction{font-size:12px;color:#555;margin-top:3px;font-style:italic}
.row-even{background:#fff}
.row-odd{background:#f9fafb}
.man-grid{border-collapse:collapse;margin:0 auto;font-size:11px}
.man-val{font-weight:700;text-align:center;padding:1px 4px;color:#111}
.man-label{font-size:10px;text-align:center;color:#555;padding:0 4px}
.man-sep{text-align:center;padding:1px 1px;color:#999;font-weight:400}
.man-legend{font-size:10px;color:#666;margin-top:6px;font-style:italic}
@media(max-width:640px){
  .pt-row{grid-template-columns:1fr;gap:2px}
  .med-table{font-size:11px}
  .med-table th,.med-table td{padding:5px 4px}
  .th-detail,.td-detail{display:none}
  .th-man,.td-man{width:70px}
}
`;

interface MedRaw {
  id: string; name: string; dosage?: string; quantity?: string; type?: string;
  frequency?: string; food?: string; time?: string; duration?: string;
  instructions?: string; flags?: string; created_at: string;
}

export default function PrescriptionPage() {
  const { token } = useParams<{ token: string }>();
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string>('');

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return; }

    (async () => {
      const { data, error } = await supabase.rpc('get_shared_prescription', { p_token: token });

      if (error) {
        console.error('RPC error:', error);
        setErrorDetail(error.message);
        setNotFound(true);
        setLoading(false);
        return;
      }

      if (!data || !data.consult) {
        setErrorDetail('No prescription found for this link');
        setNotFound(true);
        setLoading(false);
        return;
      }

      const consult = data.consult;
      const patient = data.patient;
      const rawMeds: MedRaw[] = data.medicines || [];

      // Parse summary
      let summary = consult.consult_summary_final;
      if (typeof summary === 'string') {
        try { summary = JSON.parse(summary); } catch { summary = null; }
      }
      if (!summary || typeof summary !== 'object' || Object.keys(summary).length === 0) {
        setErrorDetail('Consultation summary not yet available');
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Normalize medicines
      const meds = rawMeds.map((m) => ({
        name: m.name || '',
        dosage: m.dosage || '',
        quantity: m.quantity || '',
        type: m.type || '',
        frequency: m.frequency || '',
        time: normalizeTime(m.time),
        food: m.food || '',
        duration: m.duration || '',
        instructions: m.instructions || '',
        flags: m.flags || '',
      }));

      const getMaNGrid = (time: string[], quantity: string): string => {
        const qty = (quantity || '').trim() || '1';
        const nt = (time || []).map((t) => t.toLowerCase());
        const morning = nt.some((t) => t.includes('morning')) ? qty : '0';
        const afternoon = nt.some((t) => t.includes('afternoon') || t.includes('noon')) ? qty : '0';
        const night = nt.some((t) => t.includes('night') || t.includes('evening')) ? qty : '0';
        return `<table class="man-grid"><tr><td class="man-val">${escapeHtml(morning)}</td><td class="man-sep">-</td><td class="man-val">${escapeHtml(afternoon)}</td><td class="man-sep">-</td><td class="man-val">${escapeHtml(night)}</td></tr><tr><td class="man-label">M</td><td class="man-sep"> </td><td class="man-label">A</td><td class="man-sep"> </td><td class="man-label">N</td></tr></table>`;
      };

      const sectionOrder = ['diagnosis','chief_complaints','history','past_medical_history','examination_findings','medications','treatment','investigations','followup'];

      // Patient info
      const ptName = (patient?.name || '').toUpperCase();
      const ptAge = patient?.age ? `${patient.age}${(patient?.gender || '').charAt(0)}` : '';
      const ptDisplay = [ptName, ptAge].filter(Boolean).join(', ');

      let content = `<div class="pres-wrapper"><div class="pt-info">`;
      content += `<div class="pt-row"><div><p class="pt-name">${escapeHtml(ptDisplay)}</p></div>`;
      content += `<div style="text-align:right">`;
      if (patient?.uhid) content += `<span class="pt-meta"><span class="pt-label">UHID: </span><span class="pt-val">${escapeHtml(patient.uhid)}</span></span>`;
      content += `</div></div>`;
      content += `<div class="pt-row" style="margin-top:4px"><div><span class="pt-meta"><span class="pt-label">Date: </span><span class="pt-date-val">${escapeHtml(formatDate(consult.created_at))}</span></span></div><div style="text-align:right"></div></div>`;
      if (patient?.phone) content += `<div style="margin-top:4px"><span class="pt-meta"><span class="pt-label">Phone: </span><span class="pt-val">${escapeHtml(String(patient.phone))}</span></span></div>`;
      content += `</div>`;

      // Sections
      const sMap: Record<string, string> = {};

      if (summary.diagnosis) {
        let dc = '';
        if (typeof summary.diagnosis === 'string') {
          dc = `<p class="section-text">${escapeHtml(summary.diagnosis)}</p>`;
        } else {
          const d = summary.diagnosis as DiagnosisSummary;
          const prov = Array.isArray(d.provisional) ? d.provisional : [];
          if (prov.length) dc += `<p class="sub-label">Provisional Diagnosis</p>${toHtmlList(prov)}`;
        }
        if (dc) sMap['diagnosis'] = `<div class="section"><div class="section-header">Diagnosis / Provisional Diagnosis</div>${dc}</div>`;
      }

      if (summary.chief_complaints) {
        const cc = summary.chief_complaints;
        const h = Array.isArray(cc) ? toHtmlList(cc) : `<p class="section-text">${escapeHtml(String(cc))}</p>`;
        sMap['chief_complaints'] = `<div class="section"><div class="section-header">Chief Complaints</div>${h}</div>`;
      }

      if (summary.history) sMap['history'] = `<div class="section"><div class="section-header">History</div><p class="section-text">${escapeHtml(summary.history)}</p></div>`;

      if (summary.past_medical_history) {
        const pmh = summary.past_medical_history;
        const arr = Array.isArray(pmh) ? pmh : String(pmh).split('\n');
        const cleaned = arr.map((s: unknown) => String(s).replace(/^[-•]\s*/, '').trim()).filter(Boolean);
        if (cleaned.length) sMap['past_medical_history'] = `<div class="section"><div class="section-header">Past Medical History (K/C/O)</div><p class="section-text">${escapeHtml(cleaned.join(', '))}</p></div>`;
      }

      if (summary.examination_findings) {
        const ef = summary.examination_findings;
        const arr = Array.isArray(ef) ? ef : [String(ef)];
        const cleaned = arr.map((s: unknown) => String(s).trim()).filter(Boolean);
        if (cleaned.length) sMap['examination_findings'] = `<div class="section"><div class="section-header">Examination Findings</div>${toHtmlList(cleaned)}</div>`;
      }

      if (meds.length > 0) {
        const rows = meds.map((m, i) => {
          const man = getMaNGrid(m.time, m.quantity || m.dosage || '');
          const dq = (m.quantity || '').trim() || '1';
          const det = [m.type ? `${dq} ${escapeHtml(m.type)}` : '', m.frequency ? escapeHtml(m.frequency) : '', m.food ? `${escapeHtml(m.food)} food` : ''].filter(Boolean).join(' | ');
          const inst = m.instructions ? `<div class="med-instruction">${escapeHtml(m.instructions)}</div>` : '';
          return `<tr class="${i % 2 === 0 ? 'row-even' : 'row-odd'}"><td class="td-num">${i + 1}.</td><td class="td-name"><strong>${escapeHtml(m.name || '—')}</strong>${m.dosage && m.dosage !== m.quantity ? `<div class="med-sub">${escapeHtml(m.dosage)}</div>` : ''}${inst}</td><td class="td-man">${man}</td><td class="td-detail">${det || '—'}</td><td class="td-dur">${escapeHtml(m.duration || '—')}</td></tr>`;
        }).join('');
        sMap['medications'] = `<div class="section"><div class="section-header">Medication Prescribed</div><table class="med-table"><thead><tr><th class="th-num">#</th><th class="th-name">Medicine Name</th><th class="th-man">Dosage</th><th class="th-detail">Medicine Details</th><th class="th-dur">Duration</th></tr></thead><tbody>${rows}</tbody></table><p class="man-legend"><strong>M-A-N:</strong> Morning - Afternoon - Night</p></div>`;
      }

      if (summary.treatment_suggested) {
        let th = '';
        if (typeof summary.treatment_suggested === 'string') {
          th = `<p class="section-text">${escapeHtml(summary.treatment_suggested)}</p>`;
        } else {
          const t = summary.treatment_suggested as TreatmentSummary;
          if (Array.isArray(t.immediate_plan) && t.immediate_plan.length) th += `<p class="sub-label">Immediate Plan</p>${toHtmlList(t.immediate_plan)}`;
          if (Array.isArray(t.contingent_plan) && t.contingent_plan.length) th += `<p class="sub-label">Contingent Plan</p>${toHtmlList(t.contingent_plan)}`;
        }
        if (th) sMap['treatment'] = `<div class="section"><div class="section-header">Treatment Suggested</div>${th}</div>`;
      }

      if (summary.investigations) {
        let ih = '';
        if (typeof summary.investigations === 'string' && summary.investigations.trim()) {
          ih = `<p class="section-text">${escapeHtml(summary.investigations)}</p>`;
        } else if (typeof summary.investigations === 'object') {
          const inv = summary.investigations as InvestigationsSummary;
          const ord = Array.isArray(inv.ordered) ? inv.ordered : [];
          if (ord.length) ih += `<ul class="section-list">${ord.map((o) => `<li><strong>${escapeHtml(o?.name || '—')}</strong>${o?.body_part_or_type ? ` — ${escapeHtml(o.body_part_or_type)}` : ''}${o?.priority ? ` <span class="inv-priority">(${escapeHtml(o.priority)})</span>` : ''}</li>`).join('')}</ul>`;
          if (inv.notes) ih += `<p class="section-text">${escapeHtml(inv.notes)}</p>`;
        }
        if (ih) sMap['investigations'] = `<div class="section"><div class="section-header">Investigations</div>${ih}</div>`;
      }

      if (summary.followup_recommendations) {
        const fu = summary.followup_recommendations;
        const fh = Array.isArray(fu) ? toHtmlList(fu) : `<p class="section-text">${escapeHtml(String(fu))}</p>`;
        sMap['followup'] = `<div class="section"><div class="section-header">Advice & Instructions</div>${fh}</div>`;
      }

      for (const k of sectionOrder) { if (sMap[k]) content += sMap[k]; }
      for (const k of Object.keys(sMap)) { if (!sectionOrder.includes(k)) content += sMap[k]; }
      content += `</div>`;

      setHtmlContent(content);
      setLoading(false);
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#024CDB] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading your prescription…</p>
        </div>
      </div>
    );
  }

  if (notFound || !htmlContent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Prescription not found</h1>
          <p className="text-gray-500 text-sm">This link may have expired or is invalid. Please contact your doctor's clinic.</p>
          {errorDetail && <p className="text-xs text-red-400 mt-3">{errorDetail}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white border-b border-gray-200 px-4 py-3 text-center">
        <p className="text-sm font-semibold text-gray-700">Your Prescription</p>
      </div>
      <div className="max-w-[800px] mx-auto my-4 sm:my-6 px-2 sm:px-0">
        <style dangerouslySetInnerHTML={{ __html: PRES_CSS }} />
        <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
      </div>
      <div className="text-center py-4">
        <p className="text-xs text-gray-400">Shared securely · Powered by Docflo</p>
      </div>
    </div>
  );
}