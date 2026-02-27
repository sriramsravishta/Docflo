import { useMemo } from 'react';
import { X, Download } from 'lucide-react';
import { CreditCard as Edit } from 'lucide-react';
import type { ConsultRow, ConsultMedicineRow, PatientRow } from '../../types/db';
import type { ConsultSummary, DiagnosisSummary, TreatmentSummary, InvestigationsSummary } from '../../types/db';
import {
  getConsultSummary,
  getElapsedSeconds,
  getProgressPercent,
  getViewModeMedicines,
  safeJsonParse,
  ESTIMATED_PROCESS_SECONDS,
  MAX_PROCESS_SECONDS,
} from '../../lib/utils';

interface ConsultViewModalProps {
  consult: ConsultRow;
  consultMedicines: ConsultMedicineRow[];
  patient: PatientRow;
  userId: string | undefined;
  expandedSections: Record<string, boolean>;
  onToggleSection: (key: string) => void;
  onClose: () => void;
  onEdit: () => void;
  onDownloadPDF: () => void;
  onSendWhatsApp: () => void;
  formatDate: (s: string) => string;
  uiNow: number;
}

function SectionCard({
  title,
  children,
  tone = 'default',
}: {
  title: string;
  children: React.ReactNode;
  tone?: 'default' | 'danger';
}) {
  const toneClasses =
    tone === 'danger'
      ? 'border-red-200 bg-red-50'
      : 'border-gray-200 bg-white';

  return (
    <div className={`border rounded-lg ${toneClasses} overflow-hidden`}>
      <div className="px-4 py-3 border-b border-gray-200 bg-white/60">
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}

function isBlankString(v: unknown) {
  return typeof v === 'string' && v.trim().length === 0;
}

function renderDiagnosis(diagnosis: unknown) {
  const parsed = safeJsonParse(diagnosis);
  const d = parsed ?? diagnosis;

  if (d == null || isBlankString(d)) return <p className="text-gray-800">No diagnosis recorded</p>;

  if (typeof d === 'string') return <p className="text-gray-800 whitespace-pre-line">{d}</p>;

  if (typeof d === 'object' && d !== null) {
    const dd = d as DiagnosisSummary;
    const hasProvisional = Array.isArray(dd.provisional) && dd.provisional.length > 0;
    const hasKeyFindings = Array.isArray(dd.key_findings) && dd.key_findings.length > 0;

    if (!hasProvisional && !hasKeyFindings) return <p className="text-gray-800">No detailed diagnosis available</p>;

    return (
      <div className="space-y-3">
        {hasProvisional && (
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Provisional Diagnosis</h4>
            <ul className="list-disc list-inside space-y-1">
              {dd.provisional!.map((item, idx) => (
                <li key={idx} className="text-gray-800">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
        {hasKeyFindings && (
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Key Findings</h4>
            <ul className="list-disc list-inside space-y-1">
              {dd.key_findings!.map((item, idx) => (
                <li key={idx} className="text-gray-800">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return <p className="text-gray-800">No diagnosis recorded</p>;
}

function renderArrayContent(content: unknown, emptyText: string) {
  const parsed = safeJsonParse(content);
  const c = parsed ?? content;

  if (c == null || isBlankString(c)) return <p className="text-gray-800">{emptyText}</p>;

  if (typeof c === 'string') return <p className="text-gray-800 whitespace-pre-line">{c}</p>;

  if (Array.isArray(c)) {
    if (c.length === 0) return <p className="text-gray-800">{emptyText}</p>;
    return (
      <ul className="list-disc list-inside space-y-1">
        {c.map((item, idx) => (
          <li key={idx} className="text-gray-800">
            {String(item)}
          </li>
        ))}
      </ul>
    );
  }

  try {
    const s = JSON.stringify(c, null, 2);
    if (!s) return <p className="text-gray-800">{emptyText}</p>;
    return <p className="text-gray-800 whitespace-pre-line">{s}</p>;
  } catch {
    return <p className="text-gray-800">{String(c)}</p>;
  }
}

function renderTreatmentSuggested(treatment: unknown) {
  const parsed = safeJsonParse(treatment);
  const t = parsed ?? treatment;

  if (t == null || isBlankString(t)) return <p className="text-gray-800">No treatment recorded</p>;

  if (typeof t === 'string') return <p className="text-gray-800 whitespace-pre-line">{t}</p>;

  if (!t || typeof t !== 'object') return <p className="text-gray-800">No treatment recorded</p>;

  const tt = t as TreatmentSummary;
  const immediate = Array.isArray(tt.immediate_plan) ? tt.immediate_plan : [];
  const contingent = Array.isArray(tt.contingent_plan) ? tt.contingent_plan : [];

  if (!immediate.length && !contingent.length) return <p className="text-gray-800">No treatment recorded</p>;

  return (
    <div className="space-y-3">
      {immediate.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-700 mb-2">Immediate Plan</h4>
          <ul className="list-disc list-inside space-y-1">
            {immediate.map((item, idx) => (
              <li key={idx} className="text-gray-800">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
      {contingent.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-700 mb-2">Contingent Plan</h4>
          <ul className="list-disc list-inside space-y-1">
            {contingent.map((item, idx) => (
              <li key={idx} className="text-gray-800">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function renderMedications(medications: ReturnType<typeof getViewModeMedicines>) {
  if (!Array.isArray(medications) || medications.length === 0) {
    return <p className="text-gray-800">No medications recorded</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-50">
            {['Name', 'Dosage', 'Quantity', 'Type', 'Frequency', 'Time', 'AF/BF', 'Duration', 'Instructions', 'Flags'].map((h) => (
              <th key={h} className="border border-gray-300 px-3 py-2 text-left font-medium text-gray-700">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {medications.map((med, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="border border-gray-300 px-3 py-2 text-gray-800">{med.name || '-'}</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-800">{med.dosage || '-'}</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-800">{med.quantity || '-'}</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-800">{med.type || '-'}</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-800">{med.frequency || '-'}</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-800">
                {Array.isArray(med.time) && med.time.length ? med.time.join(', ') : '-'}
              </td>
              <td className="border border-gray-300 px-3 py-2 text-gray-800">{med.food || '-'}</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-800">{med.duration || '-'}</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-800">{med.instructions || '-'}</td>
              <td className="border border-gray-300 px-3 py-2 text-gray-800">{med.flags || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderInvestigations(investigations: unknown) {
  const parsed = safeJsonParse(investigations);
  const inv = parsed ?? investigations;

  if (inv == null || isBlankString(inv)) return <p className="text-gray-800">No investigations recorded</p>;

  if (typeof inv === 'string') return <p className="text-gray-800 whitespace-pre-line">{inv}</p>;

  if (!inv || typeof inv !== 'object') return <p className="text-gray-800">No investigations recorded</p>;

  const ii = inv as InvestigationsSummary;
  const ordered = Array.isArray(ii.ordered) ? ii.ordered : [];
  const notes = ii.notes;

  if (!ordered.length && !notes) return <p className="text-gray-800">No investigations recorded</p>;

  return (
    <div className="space-y-3">
      {ordered.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-700 mb-2">Ordered Investigations</h4>
          <div className="space-y-2">
            {ordered.map((o, idx) => (
              <div key={idx} className="bg-gray-50 border border-gray-200 rounded p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="font-medium text-gray-900">{o.name}</h5>
                    {o.body_part_or_type && <p className="text-sm text-gray-600">{o.body_part_or_type}</p>}
                  </div>
                  {o.priority && (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-gray-200 text-gray-700">{o.priority}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {notes && (
        <div>
          <h4 className="font-medium text-gray-700 mb-2">Notes</h4>
          <p className="text-gray-800 whitespace-pre-line">{String(notes)}</p>
        </div>
      )}
    </div>
  );
}

export default function ConsultViewModal(props: ConsultViewModalProps) {
  const { consult, consultMedicines, onClose, onEdit, onDownloadPDF, formatDate, uiNow } = props;

  const summary = getConsultSummary(consult) as ConsultSummary | null;
  const meds = getViewModeMedicines(summary, consultMedicines);

  const flags = useMemo(() => {
    const arr = summary && Array.isArray(summary.flags_for_review) ? summary.flags_for_review : [];
    return arr.filter((f) => typeof f === 'string' && f.trim().length > 0);
  }, [summary]);

  // content presence helpers (UI-only)
  const hasComplaints =
    !!summary?.chief_complaints &&
    !isBlankString(summary.chief_complaints) &&
    (!Array.isArray(summary.chief_complaints) || summary.chief_complaints.length > 0);

  const hasHistory = !!summary?.history && !isBlankString(summary.history);
  const hasFollowup = !!summary?.followup_recommendations && !isBlankString(summary.followup_recommendations);
  const hasInsights = !!summary?.key_personal_insights && !isBlankString(summary.key_personal_insights);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      {/* same container sizing as Edit modal -> smoother perceived transition */}
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-y-auto pb-8">
        <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Consultation Summary</h2>
              <p className="text-sm text-gray-600">{formatDate(consult.created_at)}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={onEdit}
                className="flex items-center space-x-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors"
              >
                <Edit className="w-4 h-4" />
                <span>Edit</span>
              </button>
              <button
                onClick={onDownloadPDF}
                className="flex items-center space-x-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </button>
            </div>
          </div>
        </div>

        {summary ? (
          <div className="px-6 pt-6 space-y-6">
            {/* Flags (no acknowledge button for now) */}
            {flags.length > 0 && (
              <SectionCard title="Flags for Review" tone="danger">
                <div className="space-y-2">
                  {flags.map((flag, idx) => (
                    <div key={idx} className="bg-white border border-red-200 rounded-lg p-3">
                      <p className="text-sm font-medium text-red-800">⚠ {flag}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Two-column layout on desktop for readability */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SectionCard title="Diagnosis">
                {renderDiagnosis(summary.diagnosis)}
              </SectionCard>

              {/* Only show these cards if they have content (reduces clutter) */}
              {hasComplaints ? (
                <SectionCard title="Chief Complaints">
                  {renderArrayContent(summary.chief_complaints, 'No chief complaints recorded')}
                </SectionCard>
              ) : (
                <SectionCard title="Chief Complaints">
                  {renderArrayContent(summary.chief_complaints, 'No chief complaints recorded')}
                </SectionCard>
              )}

              <SectionCard title="Treatment Suggested">
                {renderTreatmentSuggested(summary.treatment_suggested)}
              </SectionCard>

              <SectionCard title="Investigations">
                {renderInvestigations(summary.investigations)}
              </SectionCard>

              {hasHistory ? (
                <SectionCard title="History">
                  {renderArrayContent(summary.history, 'No history recorded')}
                </SectionCard>
              ) : (
                <SectionCard title="History">
                  {renderArrayContent(summary.history, 'No history recorded')}
                </SectionCard>
              )}

              {hasFollowup ? (
                <SectionCard title="Follow-up Recommendations">
                  {renderArrayContent(summary.followup_recommendations, 'No follow-up recommendations recorded')}
                </SectionCard>
              ) : (
                <SectionCard title="Follow-up Recommendations">
                  {renderArrayContent(summary.followup_recommendations, 'No follow-up recommendations recorded')}
                </SectionCard>
              )}

              {hasInsights ? (
                <SectionCard title="Key Personal Insights">
                  {renderArrayContent(summary.key_personal_insights, 'No personal insights recorded')}
                </SectionCard>
              ) : (
                <SectionCard title="Key Personal Insights">
                  {renderArrayContent(summary.key_personal_insights, 'No personal insights recorded')}
                </SectionCard>
              )}
            </div>

            {/* Medications full-width for table */}
            <SectionCard title="Medications">
              {renderMedications(meds)}
            </SectionCard>
          </div>
        ) : (
          <div className="p-6">
            <ProcessingState consult={consult} uiNow={uiNow} />
          </div>
        )}
      </div>
    </div>
  );
}

function ProcessingState({ consult, uiNow }: { consult: ConsultRow; uiNow: number }) {
  const elapsed = getElapsedSeconds(consult, uiNow);
  const pct = getProgressPercent(consult, uiNow);
  const takingLonger = elapsed > ESTIMATED_PROCESS_SECONDS;
  const isError = elapsed > MAX_PROCESS_SECONDS;

  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-3">
        <p className="text-sm font-semibold text-gray-900">
          {isError ? 'Consultation summary failed' : `Preparing consultation summary: ${elapsed}s / ${ESTIMATED_PROCESS_SECONDS}s`}
        </p>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className="h-3 rounded-full bg-[#024CDB] transition-all"
          style={{ width: `${isError ? 100 : pct}%` }}
        />
      </div>
      <div className="mt-3 text-center">
        {isError ? (
          <p className="text-sm font-semibold text-red-600">There was an issue analyzing the recording.</p>
        ) : (
          <>
            <p className="text-sm text-gray-600">It takes around 60 sec to prepare the consultation summary.</p>
            {takingLonger && <p className="text-sm mt-1 font-medium text-red-600">Taking longer than expected…</p>}
          </>
        )}
      </div>
      <div className="mt-4 text-center text-xs text-gray-500">
        {isError ? 'Please retry the recording.' : 'You can keep this open — it will auto-update when ready.'}
      </div>
    </div>
  );
}

export { renderDiagnosis, renderArrayContent, renderTreatmentSuggested, renderMedications, renderInvestigations };