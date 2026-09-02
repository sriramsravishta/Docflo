import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { ConsultRow, ConsultMedicineRow } from '../types/db';

interface PrescriptionData {
  consult: ConsultRow & { patients: { name: string; age: number; gender: string } | null; doctor_name: string };
  medicines: ConsultMedicineRow[];
}

function formatDate(s: string) {
  try { return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return s; }
}

function safeText(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

function getSummaryField(summary: unknown, key: string): string {
  if (!summary || typeof summary !== 'object') return '';
  const s = safeText((summary as Record<string, unknown>)[key] || '');
  return s.replace(/<[^>]*>/g, '').trim();
}

export default function PrescriptionPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PrescriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return; }
    (async () => {
      try {
        // Fetch consult by share_token (public anon access via RLS policy)
        const { data: consult, error } = await supabase
          .from('consult')
          .select('id, created_at, consult_summary_final, doc_id, patient_id')
          .eq('share_token', token)
          .maybeSingle();

        if (error || !consult) { setNotFound(true); setLoading(false); return; }

        // Fetch patient name (also via anon — patient table RLS should allow this)
        const [{ data: patient }, { data: medicines }] = await Promise.all([
          supabase.from('patients').select('name, age, gender').eq('id', consult.patient_id).maybeSingle(),
                    supabase.from('consult_medicine').select('*').eq('consult_id', consult.id).order('created_at'),
        ]);

        setData({
          consult: { ...consult, patients: patient || null, doctor_name: '' },
          medicines: medicines || [],
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
          <p className="text-gray-500 text-sm">Loading your prescription…</p>
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Prescription not found</h1>
          <p className="text-gray-500 text-sm">This link may have expired or is invalid. Please contact your doctor's clinic.</p>
        </div>
      </div>
    );
  }

  const { consult, medicines } = data;
  const summary = consult.consult_summary_final as Record<string, unknown> | null;

  const chiefComplaints = getSummaryField(summary, 'chief_complaints');
  const diagnosis = getSummaryField(summary, 'diagnosis');
  const treatment = getSummaryField(summary, 'treatment_suggested');
  const investigations = getSummaryField(summary, 'investigations');
  const followup = getSummaryField(summary, 'followup_recommendations');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#024CDB] text-white px-4 py-5 text-center">
        <div className="text-2xl mb-1">🩺</div>
        <h1 className="text-xl font-bold">Your Prescription</h1>
        <p className="text-blue-200 text-sm mt-0.5">{formatDate(consult.created_at)}</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Patient info */}
        {consult.patients && (
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Patient</p>
            <p className="text-gray-900 font-semibold text-lg">{consult.patients.name}</p>
            <p className="text-gray-500 text-sm">{consult.patients.age} yrs · {consult.patients.gender}</p>
          </div>
        )}

        {/* Chief complaints */}
        {chiefComplaints && (
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Chief Complaints</p>
            <p className="text-gray-800 text-sm whitespace-pre-line leading-relaxed">{chiefComplaints}</p>
          </div>
        )}

        {/* Diagnosis */}
        {diagnosis && (
          <div className="bg-blue-50 rounded-xl border border-blue-200 px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">Diagnosis</p>
            <p className="text-gray-900 text-sm whitespace-pre-line leading-relaxed">{diagnosis}</p>
          </div>
        )}

        {/* Medications */}
        {medicines.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Medications</p>
            </div>
            <div className="divide-y divide-gray-100">
              {medicines.map((med, i) => (
                <div key={med.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#024CDB]/10 text-[#024CDB] flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{med.name}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                      {med.dosage && <span className="text-xs text-gray-500">{med.dosage}</span>}
                      {med.frequency && <span className="text-xs text-gray-500">{med.frequency}</span>}
                      {med.duration && <span className="text-xs text-gray-500">for {med.duration}</span>}
                      {med.food && <span className="text-xs text-gray-500">{med.food}</span>}
                      {med.time && Array.isArray(med.time) && med.time.length > 0 && (
                        <span className="text-xs text-gray-500">{med.time.join(', ')}</span>
                      )}
                    </div>
                    {med.instructions && (
                      <p className="text-xs text-amber-700 mt-1 bg-amber-50 px-2 py-0.5 rounded">
                        {med.instructions}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Investigations */}
        {investigations && (
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Investigations</p>
            <p className="text-gray-800 text-sm whitespace-pre-line leading-relaxed">{investigations}</p>
          </div>
        )}

        {/* Treatment */}
        {treatment && (
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Treatment Plan</p>
            <p className="text-gray-800 text-sm whitespace-pre-line leading-relaxed">{treatment}</p>
          </div>
        )}

        {/* Follow-up */}
        {followup && (
          <div className="bg-emerald-50 rounded-xl border border-emerald-200 px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-2">Follow-Up</p>
            <p className="text-gray-800 text-sm whitespace-pre-line leading-relaxed">{followup}</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-2 pb-8">
          <p className="text-xs text-gray-400">This prescription was generated by your doctor and shared securely.</p>
          <p className="text-xs text-gray-400 mt-1">Powered by Docflo</p>
        </div>
      </div>
    </div>
  );
}