import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface PrescriptionData {
  consult: any;
  patient: any;
  medicines: any[];
  orgConfig: any;
}

function getSummaryField(summary: any, field: string): string | null {
  if (!summary) return null;
  const val = summary[field];
  if (!val) return null;

  if (typeof val === 'string') return val;

  // Handle structured objects
  if (field === 'diagnosis') {
    const d = val as any;
    const prov = Array.isArray(d.provisional) ? d.provisional : [];
    const clean = prov.filter((s: string) => !s.includes('AI-INFERRED'));
    return clean.length ? clean.join('\n') : null;
  }
  if (field === 'investigations') {
    const ordered = Array.isArray((val as any).ordered) ? (val as any).ordered : [];
    if (ordered.length) return ordered.map((o: any) => `${o.name || o}${o.priority ? ` (${o.priority})` : ''}`).join('\n');
    return null;
  }
  if (field === 'treatment_suggested') {
    const t = val as any;
    const imm = Array.isArray(t.immediate_plan) ? t.immediate_plan : [];
    return imm.length ? imm.join('\n') : null;
  }
  if (Array.isArray(val)) return val.join('\n');
  return String(val);
}

function parseMedTime(time: any): string[] {
  if (Array.isArray(time)) return time;
  if (typeof time === 'string') {
    try { const p = JSON.parse(time); return Array.isArray(p) ? p : []; } catch { return []; }
  }
  return [];
}

export default function PrescriptionPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [data, setData] = useState<PrescriptionData | null>(null);

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return; }

    (async () => {
      try {
        // Fetch consult by share_token
        const { data: consult, error } = await supabase
          .from('consult')
          .select('*')
          .eq('share_token', token)
          .maybeSingle();

        if (error || !consult) { setNotFound(true); setLoading(false); return; }

        // Parallel fetch: patient, medicines, org config (for header/footer)
        const [patientRes, medsRes, orgRes] = await Promise.all([
          supabase.from('patients').select('name, age, gender, phone').eq('id', consult.patient_id).maybeSingle(),
          supabase.from('consult_medicine').select('*').eq('consult_id', consult.id).order('created_at'),
          supabase.from('organizations').select('name, prescription_config').eq('auth_id', consult.doc_id).maybeSingle(),
        ]);

        setData({
          consult,
          patient: patientRes.data || null,
          medicines: medsRes.data || [],
          orgConfig: orgRes.data || null,
        });
      } catch (e) {
        console.error(e);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#024CDB] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading your prescription...</p>
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Prescription not found</h1>
          <p className="text-gray-500 text-sm">This link may have expired or is invalid. Please contact your doctor's clinic.</p>
        </div>
      </div>
    );
  }

  const { consult, patient, medicines, orgConfig } = data;

  // Parse summary
  let summary: any = consult.consult_summary_final;
  if (typeof summary === 'string') {
    try { summary = JSON.parse(summary); } catch { summary = {}; }
  }
  if (typeof summary === 'string') {
    try { summary = JSON.parse(summary); } catch { summary = {}; }
  }

  const presConfig = orgConfig?.prescription_config || {};
  const brandColor = presConfig.brand_color || '#024CDB';
  const doctorName = orgConfig?.name || '';
  const cleanDoctorName = doctorName.replace(/^Dr\.?\s*/i, '').trim();

  // Header fields (ALWAYS shown on public page)
  const hName = presConfig.print_header_doctor_name || (cleanDoctorName ? `Dr. ${cleanDoctorName}` : '');
  const hQual = presConfig.print_header_qualifications || '';
  const hClinic = presConfig.print_header_clinic_name || '';
  const hAddr = presConfig.print_header_clinic_address || '';
  const hReg = presConfig.print_header_reg_no || '';
  const footerText = presConfig.print_footer_text || '';
  const department = presConfig.department || '';

  const chiefComplaints = getSummaryField(summary, 'chief_complaints');
  const diagnosis = getSummaryField(summary, 'diagnosis');
  const history = getSummaryField(summary, 'history');
  const treatment = getSummaryField(summary, 'treatment_suggested');
  const investigations = getSummaryField(summary, 'investigations');
  const followup = getSummaryField(summary, 'followup_recommendations');
  const examination = getSummaryField(summary, 'examination_findings');

  const visitDate = consult.created_at
    ? new Date(consult.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header — solid brand-color bar (ALWAYS shown) */}
      {hName && (
        <div style={{ background: brandColor }} className="text-white px-5 py-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold tracking-wide">{hName}</h1>
              {hQual && <p className="text-sm opacity-90 mt-0.5">{hQual}{hReg ? ` | Reg: ${hReg}` : ''}</p>}
            </div>
            {(hClinic || hAddr) && (
              <div className="text-right text-sm">
                {hClinic && <p className="font-semibold opacity-95">{hClinic}</p>}
                {hAddr && <p className="opacity-85 text-xs mt-0.5">{hAddr}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-3">

        {/* Patient info */}
        {patient && (
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Patient</p>
                <p className="text-gray-900 font-semibold text-lg">{patient.name}</p>
                <p className="text-gray-500 text-sm">{patient.age} yrs · {patient.gender}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Date</p>
                <p className="text-sm font-semibold text-gray-900">{visitDate}</p>
              </div>
            </div>
          </div>
        )}

        {/* Diagnosis */}
        {diagnosis && (
          <div className="bg-blue-50 rounded-xl border border-blue-200 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-1.5">Diagnosis</p>
            <p className="text-gray-900 text-sm whitespace-pre-line leading-relaxed">{diagnosis}</p>
          </div>
        )}

        {/* Chief complaints */}
        {chiefComplaints && (
          <Section title="Chief Complaints" text={chiefComplaints} />
        )}

        {/* History */}
        {history && (
          <Section title="History of Present Illness" text={history} />
        )}

        {/* Examination */}
        {examination && (
          <Section title="Examination Findings" text={examination} />
        )}

        {/* Medications */}
        {medicines.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Medications</p>
            </div>
            <div className="divide-y divide-gray-100">
              {medicines.map((med, i) => {
                const timeArr = parseMedTime(med.time);
                return (
                  <div key={med.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5" style={{ background: `${brandColor}15`, color: brandColor }}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">
                        {med.name}{med.dosage ? ` ${med.dosage}` : ''}{med.type ? ` (${med.type})` : ''}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                        {timeArr.length > 0 && <span className="text-xs text-gray-500">{timeArr.join(', ')}</span>}
                        {med.food && <span className="text-xs text-gray-500">{med.food === 'AF' ? 'After food' : med.food === 'BF' ? 'Before food' : med.food}</span>}
                        {med.duration && <span className="text-xs text-gray-500">for {med.duration}</span>}
                      </div>
                      {med.instructions && (
                        <p className="text-xs text-amber-700 mt-1 bg-amber-50 px-2 py-0.5 rounded inline-block">
                          {med.instructions}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Investigations */}
        {investigations && (
          <Section title="Investigations Advised" text={investigations} />
        )}

        {/* Treatment */}
        {treatment && (
          <Section title="Treatment Plan" text={treatment} />
        )}

        {/* Follow-up */}
        {followup && (
          <div className="bg-emerald-50 rounded-xl border border-emerald-200 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-1.5">Follow-Up & Instructions</p>
            <p className="text-gray-800 text-sm whitespace-pre-line leading-relaxed">{followup}</p>
          </div>
        )}

        {/* Doctor signature */}
        <div className="text-right pt-2 pr-2">
          {cleanDoctorName && <p className="font-bold text-gray-900">Dr. {cleanDoctorName}</p>}
          {department && <p className="text-sm text-gray-600">{department}</p>}
          <p className="text-xs text-gray-400 mt-0.5">{visitDate}</p>
        </div>

        {/* Footer */}
        {footerText && (
          <div className="text-center pt-2 pb-2 border-t-2" style={{ borderColor: brandColor }}>
            {footerText.split('\n').map((line: string, i: number) => (
              <p key={i} className="text-xs text-gray-500">{line}</p>
            ))}
          </div>
        )}

        <div className="text-center pb-6">
          <p className="text-xs text-gray-300">Powered by Docflo</p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, text }: { title: string; text: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">{title}</p>
      <p className="text-gray-800 text-sm whitespace-pre-line leading-relaxed">{text}</p>
    </div>
  );
}