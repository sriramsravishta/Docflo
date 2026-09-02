import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  getConsultSummary,
  normalizeTime,
  escapeHtml,
  toHtmlList,
} from '../lib/utils';
import type { ConsultRow, ConsultMedicineRow } from '../types/db';
import type { ConsultSummary, DiagnosisSummary, TreatmentSummary, InvestigationsSummary } from '../types/db';

function formatDate(s: string) {
  try {
    return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return s;
  }
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
      // 1. Fetch consult
      const { data: consult, error: consultError } = await supabase
        .from('consult')
        .select('id, created_at, consult_summary_final, doc_id, patient_id')
        .eq('share_token', token)
        .maybeSingle();

      if (consultError) {
        console.error('Consult fetch error:', consultError);
        setErrorDetail(`Consult: ${consultError.message}`);
        setNotFound(true);
        setLoading(false);
        return;
      }
      if (!consult) {
        setErrorDetail('No consult found for this token');
        setNotFound(true);
        setLoading(false);
        return;
      }

      // 2. Fetch patient (best-effort)
      let patient: { name: string; age: number; gender: string; phone?: string; uhid?: string } | null = null;
      {
        const { data: p, error: pErr } = await supabase
          .from('patients')
          .select('name, age, gender, phone, uhid')
          .eq('id', consult.patient_id)
          .maybeSingle();
        if (pErr) console.warn('Patient fetch failed:', pErr.message);
        patient = p;
      }

      // 3. Fetch medicines (best-effort)
      let medicines: ConsultMedicineRow[] = [];
      {
        const { data: m, error: mErr } = await supabase
          .from('consult_medicine')
          .select('*')
          .eq('consult_id', consult.id)
          .order('created_at');
        if (mErr) console.warn('Medicines fetch failed:', mErr.message);
        medicines = m || [];
      }

      // 4. Build HTML using same logic as PDF
      const summary = getConsultSummary(consult as ConsultRow) as ConsultSummary | null;
      if (!summary) {
        setErrorDetail('Consultation summary not yet available');
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Normalize medicines for display (same as getViewModeMedicines)
      const meds = medicines.length > 0
        ? medicines.map((m) => ({
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
          }))
        : [];

      const getMaNGrid = (time: string[], quantity: string): string => {
        const rawQty = (quantity || '').trim();
        const qty = rawQty || '1';
        const normalizedTime = (time || []).map((t) => t.toLowerCase());
        const morning = normalizedTime.some((t) => t.includes('morning')) ? qty : '0';
        const afternoon = normalizedTime.some((t) => t.includes('afternoon') || t.includes('noon')) ? qty : '0';
        const night = normalizedTime.some((t) => t.includes('night') || t.includes('evening')) ? qty : '0';
        return `
          <table class="man-grid">
            <tr>
              <td class="man-val">${escapeHtml(morning)}</td>
              <td class="man-sep">-</td>
              <td class="man-val">${escapeHtml(afternoon)}</td>
              <td class="man-sep">-</td>
              <td class="man-val">${escapeHtml(night)}</td>
            </tr>
            <tr>
              <td class="man-label">M</td>
              <td class="man-sep"> </td>
              <td class="man-label">A</td>
              <td class="man-sep"> </td>
              <td class="man-label">N</td>
            </tr>
          </table>
        `;
      };

      // Section ordering (default — no presConfig available publicly)
      const sectionOrder = ['diagnosis','chief_complaints','history','past_medical_history','examination_findings','medications','treatment','investigations','followup'];

      // Build patient info
      const ptName = (patient?.name || '').toUpperCase();
      const ptAge = patient?.age ? `${patient.age}${(patient?.gender || '').charAt(0)}` : '';
      const ptDisplay = [ptName, ptAge].filter(Boolean).join(', ');
      const ptUhid = patient?.uhid;
      const ptPhone = patient?.phone;

      let content = `<div class="pres-wrapper"><div class="pt-info">`;
      content += `<div class="pt-row">`;
      content += `<div><p class="pt-name">${escapeHtml(ptDisplay)}</p></div>`;
      content += `<div style="text-align:right">`;
      if (ptUhid) content += `<span class="pt-meta"><span class="pt-label">UHID: </span><span class="pt-val">${escapeHtml(ptUhid)}</span></span>`;
      content += `</div></div>`;

      content += `<div class="pt-row" style="margin-top:4px">`;
      content += `<div><span class="pt-meta"><span class="pt-label">Date: </span><span class="pt-date-val">${escapeHtml(formatDate(consult.created_at))}</span></span></div>`;
      content += `<div style="text-align:right"></div></div>`;

      if (ptPhone) {
        content += `<div style="margin-top:4px"><span class="pt-meta"><span class="pt-label">Phone: </span><span class="pt-val">${escapeHtml(String(ptPhone))}</span></span></div>`;
      }
      content += `</div>`; // close pt-info

      // Build sections
      const sectionHtmlMap: Record<string, string> = {};

      if (summary.diagnosis) {
        let diagContent = '';
        if (typeof summary.diagnosis === 'string') {
          diagContent = `<p class="section-text">${escapeHtml(summary.diagnosis)}</p>`;
        } else {
          const d = summary.diagnosis as DiagnosisSummary;
          const prov = Array.isArray(d.provisional) ? d.provisional : [];
          if (prov.length) diagContent += `<p class="sub-label">Provisional Diagnosis</p>${toHtmlList(prov)}`;
        }
        if (diagContent) sectionHtmlMap['diagnosis'] = `<div class="section"><div class="section-header">Diagnosis / Provisional Diagnosis</div>${diagContent}</div>`;
      }

      if (summary.chief_complaints) {
        const cc = summary.chief_complaints;
        const ccHtml = Array.isArray(cc) ? toHtmlList(cc) : `<p class="section-text">${escapeHtml(String(cc))}</p>`;
        sectionHtmlMap['chief_complaints'] = `<div class="section"><div class="section-header">Chief Complaints</div>${ccHtml}</div>`;
      }

      if (summary.history) {
        sectionHtmlMap['history'] = `<div class="section"><div class="section-header">History</div><p class="section-text">${escapeHtml(summary.history)}</p></div>`;
      }

      if ((summary as any).past_medical_history) {
        const pmh = (summary as any).past_medical_history;
        const pmhArr = Array.isArray(pmh) ? pmh : String(pmh).split('\n');
        const cleaned = pmhArr.map((s: unknown) => String(s).replace(/^[-•]\s*/, '').trim()).filter(Boolean);
        if (cleaned.length) {
          sectionHtmlMap['past_medical_history'] = `<div class="section"><div class="section-header">Past Medical History (K/C/O)</div><p class="section-text">${escapeHtml(cleaned.join(', '))}</p></div>`;
        }
      }

      if ((summary as any).examination_findings) {
        const ef = (summary as any).examination_findings;
        const efArr = Array.isArray(ef) ? ef : [String(ef)];
        const cleaned = efArr.map((s: unknown) => String(s).trim()).filter(Boolean);
        if (cleaned.length) {
          sectionHtmlMap['examination_findings'] = `<div class="section"><div class="section-header">Examination Findings</div>${toHtmlList(cleaned)}</div>`;
        }
      }

      if (meds.length > 0) {
        const medsRows = meds.map((m, idx) => {
          const manGrid = getMaNGrid(m.time, m.quantity || m.dosage || '');
          const rawQty = (m.quantity || '').trim();
          const displayQty = rawQty || '1';
          const detailParts = [
            m.type ? `${displayQty} ${escapeHtml(m.type)}` : '',
            m.frequency ? escapeHtml(m.frequency) : '',
            m.food ? `${escapeHtml(m.food)} food` : '',
          ].filter(Boolean);
          const detailLine = detailParts.join(' | ');
          const instructionLine = m.instructions ? `<div class="med-instruction">${escapeHtml(m.instructions)}</div>` : '';
          return `
            <tr class="${idx % 2 === 0 ? 'row-even' : 'row-odd'}">
              <td class="td-num">${idx + 1}.</td>
              <td class="td-name">
                <strong>${escapeHtml(m.name || '—')}</strong>
                ${m.dosage && m.dosage !== m.quantity ? `<div class="med-sub">${escapeHtml(m.dosage)}</div>` : ''}
                ${instructionLine}
              </td>
              <td class="td-man">${manGrid}</td>
              <td class="td-detail">${detailLine || '—'}</td>
              <td class="td-dur">${escapeHtml(m.duration || '—')}</td>
            </tr>
          `;
        }).join('');
        sectionHtmlMap['medications'] = `<div class="section"><div class="section-header">Medication Prescribed</div><table class="med-table"><thead><tr><th class="th-num">#</th><th class="th-name">Medicine Name</th><th class="th-man">Dosage</th><th class="th-detail">Medicine Details</th><th class="th-dur">Duration</th></tr></thead><tbody>${medsRows}</tbody></table><p class="man-legend"><strong>M-A-N:</strong> Morning - Afternoon - Night</p></div>`;
      }

      if (summary.treatment_suggested) {
        let treatHtml = '';
        if (typeof summary.treatment_suggested === 'string') {
          treatHtml = `<p class="section-text">${escapeHtml(summary.treatment_suggested)}</p>`;
        } else {
          const t = summary.treatment_suggested as TreatmentSummary;
          const immediate = Array.isArray(t.immediate_plan) ? t.immediate_plan : [];
          const contingent = Array.isArray(t.contingent_plan) ? t.contingent_plan : [];
          if (immediate.length) treatHtml += `<p class="sub-label">Immediate Plan</p>${toHtmlList(immediate)}`;
          if (contingent.length) treatHtml += `<p class="sub-label">Contingent Plan</p>${toHtmlList(contingent)}`;
        }
        if (treatHtml) sectionHtmlMap['treatment'] = `<div class="section"><div class="section-header">Treatment Suggested</div>${treatHtml}</div>`;
      }

      if (summary.investigations) {
        let invHtml = '';
        if (typeof summary.investigations === 'string' && summary.investigations.trim()) {
          invHtml = `<p class="section-text">${escapeHtml(summary.investigations)}</p>`;
        } else if (typeof summary.investigations === 'object') {
          const inv = summary.investigations as InvestigationsSummary;
          const ordered = Array.isArray(inv.ordered) ? inv.ordered : [];
          if (ordered.length) {
            invHtml += `<ul class="section-list">${ordered.map((o) =>
              `<li><strong>${escapeHtml(o?.name || '—')}</strong>${o?.body_part_or_type ? ` — ${escapeHtml(o.body_part_or_type)}` : ''}${o?.priority ? ` <span class="inv-priority">(${escapeHtml(o.priority)})</span>` : ''}</li>`
            ).join('')}</ul>`;
          }
          if (inv.notes) invHtml += `<p class="section-text">${escapeHtml(inv.notes)}</p>`;
        }
        if (invHtml) sectionHtmlMap['investigations'] = `<div class="section"><div class="section-header">Investigations</div>${invHtml}</div>`;
      }

      if (summary.followup_recommendations) {
        const fu = summary.followup_recommendations;
        const fuHtml = Array.isArray(fu) ? toHtmlList(fu) : `<p class="section-text">${escapeHtml(String(fu))}</p>`;
        sectionHtmlMap['followup'] = `<div class="section"><div class="section-header">Advice & Instructions</div>${fuHtml}</div>`;
      }

      // Assemble in order
      for (const key of sectionOrder) {
        if (sectionHtmlMap[key]) content += sectionHtmlMap[key];
      }
      for (const key of Object.keys(sectionHtmlMap)) {
        if (!sectionOrder.includes(key)) content += sectionHtmlMap[key];
      }

      content += `</div>`; // close pres-wrapper

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
      {/* Minimal header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 text-center">
        <p className="text-sm font-semibold text-gray-700">Your Prescription</p>
      </div>

      {/* Prescription card — exact PDF layout */}
      <div className="max-w-[800px] mx-auto my-4 sm:my-6 px-2 sm:px-0">
        <style dangerouslySetInnerHTML={{ __html: `
          .pres-wrapper{border:1.5px solid #111;margin:0;padding:0;background:#fff}
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
          .section-list{margin:4px 0 4px 18px;padding:0}
          .section-list li{font-size:14px;margin-bottom:3px;color:#222}
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
        `}} />
        <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
      </div>

      {/* Footer */}
      <div className="text-center py-4">
        <p className="text-xs text-gray-400">Shared securely · Powered by Docflo</p>
      </div>
    </div>
  );
}