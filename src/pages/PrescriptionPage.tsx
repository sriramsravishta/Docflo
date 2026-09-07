import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { normalizeTime, escapeHtml, toHtmlList } from '../lib/utils';
import type { DiagnosisSummary, TreatmentSummary, InvestigationsSummary } from '../types/db';

function fmtDate(s: string) {
  try { return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return s; }
}

const PRES_CSS = `
*{box-sizing:border-box}
body{font-family:Arial,sans-serif;margin:0;padding:0;line-height:1.6;color:#111;font-size:14px;background:#f5f5f5}
.pres-wrapper{border:1.5px solid #111;margin:0;padding:0;background:#fff}

/* Header — clean white with optional logo */
.pres-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:2px solid #e5e7eb;gap:16px}
.header-logo{flex-shrink:0}
.header-logo img{max-height:50px;width:auto}
.header-info{text-align:right;flex:1}
.header-info.no-logo{text-align:left}
.header-name{font-size:17px;font-weight:700;color:#111;margin:0;letter-spacing:0.01em}
.header-qual{font-size:11px;color:#555;margin:2px 0 0;font-weight:400}
.header-contact{font-size:11px;color:#555;margin:2px 0 0}

.pt-info{padding:14px 16px 12px 16px;border-bottom:1px solid #ccc}
.pt-row{display:grid;grid-template-columns:1fr 1fr;gap:4px 32px;margin-bottom:2px}
.pt-name{font-size:16px;font-weight:700;text-transform:uppercase;color:#111;margin:0 0 4px 0}
.pt-meta{font-size:13px;color:#333}
.pt-label{font-weight:400;color:#555}
.pt-val{font-weight:400;color:#111}
.pt-date-val{font-weight:700;color:#111}
.section{margin:0;padding:12px 16px;border-bottom:1px solid #ccc}
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
.signature-wrapper{break-inside:avoid}
.signature{text-align:right;padding:24px 20px 16px 16px}
.sig-name{font-size:14px;font-weight:700;text-transform:uppercase;margin:0 0 2px 0;color:#111}
.sig-dept{font-size:13px;font-weight:400;color:#111;margin:0 0 2px 0}
.sig-date{font-size:12px;color:#555;margin:0}
.pres-footer{padding:8px 20px;text-align:center}
.pres-footer p{font-size:10.5px;color:#555;margin:1px 0}
@media(max-width:640px){
  .pres-wrapper{border-width:1px}
  .pt-row{grid-template-columns:1fr;gap:2px}
  .med-table{font-size:11px}
  .med-table th,.med-table td{padding:5px 4px}
  .th-detail,.td-detail{display:none}
  .th-man,.td-man{width:70px}
  .pres-header{flex-direction:column;gap:8px;align-items:center;text-align:center}
  .header-info{text-align:center}
  .header-info.no-logo{text-align:center}
}
`;

export default function PrescriptionPage() {
  const { token } = useParams<{ token: string }>();
  const [htmlContent, setHtmlContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [errorDetail, setErrorDetail] = useState('');

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return; }
    (async () => {
      const { data, error } = await supabase.rpc('get_shared_prescription', { p_token: token });
      if (error) { console.error('RPC error:', error); setErrorDetail(error.message); setNotFound(true); setLoading(false); return; }
      if (!data || !data.consult) { setErrorDetail('No prescription found for this link'); setNotFound(true); setLoading(false); return; }

      const consult = data.consult;
      const patient = data.patient;
      const rawMeds: any[] = data.medicines || [];
      const orgData = data.org || {};
      const presConfig = orgData.prescription_config || {};
      const brandColor = presConfig.brand_color || '#024CDB';

      const rawDocName = orgData.name || '';
      const cleanDocName = rawDocName.replace(/^Dr\.?\s*/i, '').trim();
      const doctorName = cleanDocName ? `Dr. ${cleanDocName}` : rawDocName;

      let summary = consult.consult_summary_final;
      if (typeof summary === 'string') { try { summary = JSON.parse(summary); } catch { summary = null; } }
      if (typeof summary === 'string') { try { summary = JSON.parse(summary); } catch { summary = null; } }
      if (!summary || typeof summary !== 'object' || Object.keys(summary).length === 0) { setErrorDetail('Consultation summary not yet available'); setNotFound(true); setLoading(false); return; }

      const meds = rawMeds.map((m: any) => ({ name: m.name||'', dosage: m.dosage||'', quantity: m.quantity||'', type: m.type||'', frequency: m.frequency||'', time: normalizeTime(m.time), food: m.food||'', duration: m.duration||'', instructions: m.instructions||'', flags: m.flags||'' }));

      const getMaN = (time: string[], qty: string): string => {
        const q = (qty||'').trim()||'1'; const nt = (time||[]).map(t=>t.toLowerCase());
        const mo = nt.some(t=>t.includes('morning'))?q:'0';
        const af = nt.some(t=>t.includes('afternoon')||t.includes('noon'))?q:'0';
        const ni = nt.some(t=>t.includes('night')||t.includes('evening'))?q:'0';
        return `<table class="man-grid"><tr><td class="man-val">${escapeHtml(mo)}</td><td class="man-sep">-</td><td class="man-val">${escapeHtml(af)}</td><td class="man-sep">-</td><td class="man-val">${escapeHtml(ni)}</td></tr><tr><td class="man-label">M</td><td class="man-sep"> </td><td class="man-label">A</td><td class="man-sep"> </td><td class="man-label">N</td></tr></table>`;
      };

      const sectionOrder: string[] = presConfig.section_order || ['diagnosis','chief_complaints','history','past_medical_history','examination_findings','medications','treatment','investigations','followup'];

      // HEADER (ALWAYS ON)
      const hName = presConfig.print_header_doctor_name || doctorName || '';
      const hQual = presConfig.print_header_qualifications || '';
      const hReg = presConfig.print_header_reg_no || '';
      const hContact = presConfig.print_header_contact || '';
      const logoUrl = presConfig.logo_url || '';

      let headerHtml = '';
      if (hName) {
        const hasLogo = !!logoUrl;
        headerHtml = `<div class="pres-header">
          ${hasLogo ? `<div class="header-logo"><img src="${escapeHtml(logoUrl)}" alt="Logo" /></div>` : ''}
          <div class="header-info${hasLogo ? '' : ' no-logo'}">
            <p class="header-name">${escapeHtml(hName)}</p>
            ${hQual ? `<p class="header-qual">${escapeHtml(hQual)}${hReg ? ` | Reg: ${escapeHtml(hReg)}` : ''}</p>` : ''}
            ${hContact ? `<p class="header-contact">${escapeHtml(hContact)}</p>` : ''}
          </div>
        </div>`;
      }

      // Patient info
      const ptName = (patient?.name||'').toUpperCase();
      const ptAge = patient?.age ? `${patient.age}${(patient?.gender||'').charAt(0)}` : '';
      const ptDisplay = [ptName, ptAge].filter(Boolean).join(', ');
      const visitDate = fmtDate(consult.created_at);

      let c = `<div class="pres-wrapper">${headerHtml}<div class="pt-info">`;
      c += `<div class="pt-row"><div><p class="pt-name">${escapeHtml(ptDisplay)}</p></div><div style="text-align:right">`;
      if (patient?.uhid) c += `<span class="pt-meta"><span class="pt-label">UHID: </span><span class="pt-val">${escapeHtml(patient.uhid)}</span></span>`;
      c += `</div></div>`;
      c += `<div class="pt-row" style="margin-top:4px"><div><span class="pt-meta"><span class="pt-label">Date: </span><span class="pt-date-val">${escapeHtml(visitDate)}</span></span></div><div style="text-align:right"></div></div>`;
      if (patient?.phone) c += `<div style="margin-top:4px"><span class="pt-meta"><span class="pt-label">Phone: </span><span class="pt-val">${escapeHtml(String(patient.phone))}</span></span></div>`;
      c += `</div>`;

      // Sections
      const s: Record<string, string> = {};
      if (summary.diagnosis) { let d=''; if (typeof summary.diagnosis==='string') d=`<p class="section-text">${escapeHtml(summary.diagnosis)}</p>`; else { const dx=summary.diagnosis as DiagnosisSummary; const prov=Array.isArray(dx.provisional)?dx.provisional:[]; if(prov.length) d+=`<p class="sub-label">Provisional Diagnosis</p>${toHtmlList(prov)}`; } if(d) s['diagnosis']=`<div class="section"><div class="section-header">Diagnosis / Provisional Diagnosis</div>${d}</div>`; }
      if (summary.chief_complaints) { const cc=summary.chief_complaints; const h=Array.isArray(cc)?toHtmlList(cc):`<p class="section-text">${escapeHtml(String(cc))}</p>`; s['chief_complaints']=`<div class="section"><div class="section-header">Chief Complaints</div>${h}</div>`; }
      if (summary.history) s['history']=`<div class="section"><div class="section-header">History</div><p class="section-text">${escapeHtml(summary.history)}</p></div>`;
      if (summary.past_medical_history) { const pmh=summary.past_medical_history; const arr=Array.isArray(pmh)?pmh:String(pmh).split('\n'); const cl=arr.map((x:unknown)=>String(x).replace(/^[-•]\s*/,'').trim()).filter(Boolean); if(cl.length) s['past_medical_history']=`<div class="section"><div class="section-header">Past Medical History (K/C/O)</div><p class="section-text">${escapeHtml(cl.join(', '))}</p></div>`; }
      if (summary.examination_findings) { const ef=summary.examination_findings; const arr=Array.isArray(ef)?ef:[String(ef)]; const cl=arr.map((x:unknown)=>String(x).trim()).filter(Boolean); if(cl.length) s['examination_findings']=`<div class="section"><div class="section-header">Examination Findings</div>${toHtmlList(cl)}</div>`; }

      if (meds.length > 0) {
        const rows = meds.map((m, i) => {
          const man = getMaN(m.time, m.quantity||m.dosage||'');
          const dq = (m.quantity||'').trim()||'1';
          const det = [m.type?`${dq} ${escapeHtml(m.type)}`:'', m.frequency?escapeHtml(m.frequency):'', m.food?`${escapeHtml(m.food)} food`:''].filter(Boolean).join(' | ');
          const inst = m.instructions?`<div class="med-instruction">${escapeHtml(m.instructions)}</div>`:'';
          return `<tr class="${i%2===0?'row-even':'row-odd'}"><td class="td-num">${i+1}.</td><td class="td-name"><strong>${escapeHtml(m.name||'')}</strong>${m.dosage&&m.dosage!==m.quantity?`<div class="med-sub">${escapeHtml(m.dosage)}</div>`:''}${inst}</td><td class="td-man">${man}</td><td class="td-detail">${det||''}</td><td class="td-dur">${escapeHtml(m.duration||'')}</td></tr>`;
        }).join('');
        s['medications']=`<div class="section"><div class="section-header">Medication Prescribed</div><table class="med-table"><thead><tr><th class="th-num">#</th><th class="th-name">Medicine Name</th><th class="th-man">Dosage</th><th class="th-detail">Medicine Details</th><th class="th-dur">Duration</th></tr></thead><tbody>${rows}</tbody></table><p class="man-legend"><strong>M-A-N:</strong> Morning - Afternoon - Night</p></div>`;
      }

      if (summary.treatment_suggested) { let th=''; if(typeof summary.treatment_suggested==='string') th=`<p class="section-text">${escapeHtml(summary.treatment_suggested)}</p>`; else { const t=summary.treatment_suggested as TreatmentSummary; if(Array.isArray(t.immediate_plan)&&t.immediate_plan.length) th+=`<p class="sub-label">Immediate Plan</p>${toHtmlList(t.immediate_plan)}`; if(Array.isArray(t.contingent_plan)&&t.contingent_plan.length) th+=`<p class="sub-label">Contingent Plan</p>${toHtmlList(t.contingent_plan)}`; } if(th) s['treatment']=`<div class="section"><div class="section-header">Treatment Suggested</div>${th}</div>`; }

      if (summary.investigations) { let ih=''; if(typeof summary.investigations==='string'&&summary.investigations.trim()) ih=`<p class="section-text">${escapeHtml(summary.investigations)}</p>`; else if(typeof summary.investigations==='object') { const inv=summary.investigations as InvestigationsSummary; const ord=Array.isArray(inv.ordered)?inv.ordered:[]; if(ord.length) ih+=`<ul class="section-list">${ord.map((o:any)=>`<li><strong>${escapeHtml(o?.name||'')}</strong>${o?.body_part_or_type?` — ${escapeHtml(o.body_part_or_type)}`:''}${o?.priority?` <span class="inv-priority">(${escapeHtml(o.priority)})</span>`:''}</li>`).join('')}</ul>`; if(inv.notes) ih+=`<p class="section-text">${escapeHtml(inv.notes)}</p>`; } if(ih) s['investigations']=`<div class="section"><div class="section-header">Investigations</div>${ih}</div>`; }

      if (summary.followup_recommendations) { const fu=summary.followup_recommendations; const fh=Array.isArray(fu)?toHtmlList(fu):`<p class="section-text">${escapeHtml(String(fu))}</p>`; s['followup']=`<div class="section"><div class="section-header">Advice & Instructions</div>${fh}</div>`; }

      for (const k of sectionOrder) { if(s[k]) c+=s[k]; }
      for (const k of Object.keys(s)) { if(!sectionOrder.includes(k)) c+=s[k]; }

      // Signature
      const sigDept = presConfig.department || '';
      c += `<div class="signature-wrapper"><div class="signature"><p class="sig-name">${escapeHtml(doctorName.toUpperCase())}</p>${sigDept?`<p class="sig-dept">${escapeHtml(sigDept)}</p>`:''}<p class="sig-date">Visit Date: ${escapeHtml(visitDate)}</p></div></div>`;

      // Footer
      const footerText = (presConfig.print_footer_text||'').replace(/[^\x00-\x7F]/g,'').trim();
      if (footerText) c += `<div class="pres-footer" style="border-top:3px solid ${brandColor}">${footerText.split('\n').map((l:string)=>`<p>${escapeHtml(l.trim())}</p>`).join('')}</div>`;
      c += `</div>`;
      setHtmlContent(c);
      setLoading(false);
    })();
  }, [token]);

  if (loading) return (<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="flex flex-col items-center gap-3"><div className="w-10 h-10 border-4 border-[#024CDB] border-t-transparent rounded-full animate-spin" /><p className="text-gray-500 text-sm">Loading your prescription...</p></div></div>);
  if (notFound || !htmlContent) return (<div className="min-h-screen bg-gray-50 flex items-center justify-center p-6"><div className="max-w-sm text-center"><h1 className="text-xl font-bold text-gray-900 mb-2">Prescription not found</h1><p className="text-gray-500 text-sm">This link may have expired or is invalid. Please contact your doctor's clinic.</p>{errorDetail && <p className="text-xs text-red-400 mt-3">{errorDetail}</p>}</div></div>);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-[800px] mx-auto my-4 sm:my-6 px-2 sm:px-0">
        <style dangerouslySetInnerHTML={{ __html: PRES_CSS }} />
        <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
      </div>
      <div className="text-center py-4"><p className="text-xs text-gray-400">Shared securely · Powered by Docflo</p></div>
    </div>
  );
}