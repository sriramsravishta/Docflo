import { X, ChevronDown, ChevronRight, Download, MessageSquare } from 'lucide-react';
import { CreditCard as Edit } from 'lucide-react';
import type { ConsultRow, ConsultMedicineRow, PatientRow } from '../../types/db';
import type { ConsultSummary, DiagnosisSummary, TreatmentSummary, InvestigationsSummary } from '../../types/db';
import {
  getConsultSummary,
  isConsultProcessed,
  isConsultError,
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

function AccordionSection({
  title,
  sectionKey,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  sectionKey: string;
  expanded: boolean;
  onToggle: (k: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <button
        onClick={() => onToggle(sectionKey)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {expanded ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />}
      </button>
      {expanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function renderDiagnosis(diagnosis: unknown) {
  const parsed = safeJsonParse(diagnosis);
  const d = parsed ?? diagnosis;
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
              {dd.provisional!.map((item, idx) => <li key={idx} className="text-gray-800">{item}</li>)}
            </ul>
          </div>
        )}
        {hasKeyFindings && (
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Key Findings</h4>
            <ul className="list-disc list-inside space-y-1">
              {dd.key_findings!.map((item, idx) => <li key={idx} className="text-gray-800">{item}</li>)}
            </ul>
          </div>
        )}
      </div>
    );
  }
  return <p className="text-gray-800">No detailed diagnosis available</p>;
}

function renderArrayContent(content: unknown) {
  const parsed = safeJsonParse(content);
  const c = parsed ?? content;
  if (typeof c === 'string') return <p className="text-gray-800 whitespace-pre-line">{c}</p>;
  if (Array.isArray(c)) {
    return (
      <ul className="list-disc list-inside space-y-1">
        {c.map((item, idx) => <li key={idx} className="text-gray-800">{item}</li>)}
      </ul>
    );
  }
  try { return <p className="text-gray-800 whitespace-pre-line">{JSON.stringify(c, null, 2)}</p>; }
  catch { return <p className="text-gray-800">{String(c)}</p>; }
}

function renderTreatmentSuggested(treatment: unknown) {
  const parsed = safeJsonParse(treatment);
  const t = parsed ?? treatment;
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
            {immediate.map((item, idx) => <li key={idx} className="text-gray-800">{item}</li>)}
          </ul>
        </div>
      )}
      {contingent.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-700 mb-2">Contingent Plan</h4>
          <ul className="list-disc list-inside space-y-1">
            {contingent.map((item, idx) => <li key={idx} className="text-gray-800">{item}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function renderMedications(medications: ReturnType<typeof getViewModeMedicines>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-50">
            {['Name','Dosage','Quantity','Type','Frequency','Time','AF/BF','Duration','Instructions','Flags'].map((h) => (
              <th key={h} className="border border-gray-300 px-3 py-2 text-left font-medium text-gray-700">{h}</th>
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

export default function ConsultViewModal({
  consult,
  consultMedicines,
  expandedSections,
  onToggleSection,
  onClose,
  onEdit,
  onDownloadPDF,
  onSendWhatsApp,
  formatDate,
  uiNow,
}: ConsultViewModalProps) {
  const summary = getConsultSummary(consult) as ConsultSummary | null;
  const meds = getViewModeMedicines(summary, consultMedicines);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-y-auto">
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
                <Edit className="w-4 h-4" /><span>Edit</span>
              </button>
              <button
                onClick={onDownloadPDF}
                className="flex items-center space-x-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors"
              >
                <Download className="w-4 h-4" /><span>Download PDF</span>
              </button>
              
            </div>
          </div>
        </div>

        {summary ? (
          <>
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex flex-wrap gap-2">
                {summary.chief_complaints && (
                  <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs">
                    {Array.isArray(summary.chief_complaints) ? summary.chief_complaints.length : 1} Complaints
                  </span>
                )}
                {meds.length > 0 && (
                  <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs">{meds.length} Medications</span>
                )}
                {summary.investigations && typeof summary.investigations === 'object' &&
                  Array.isArray((summary.investigations as InvestigationsSummary).ordered) && (
                  <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs">
                    {(summary.investigations as InvestigationsSummary).ordered!.length} Investigations
                  </span>
                )}
                {Array.isArray(summary.flags_for_review) && summary.flags_for_review.length > 0 && (
                  <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                    {summary.flags_for_review.length} Flags
                  </span>
                )}
              </div>
            </div>

            <div className="divide-y divide-gray-200">
              {summary.diagnosis && (
                <AccordionSection title="Diagnosis" sectionKey="diagnosis" expanded={!!expandedSections.diagnosis} onToggle={onToggleSection}>
                  {renderDiagnosis(summary.diagnosis)}
                </AccordionSection>
              )}
              {summary.chief_complaints && (
                <AccordionSection title="Chief Complaints" sectionKey="chiefComplaints" expanded={!!expandedSections.chiefComplaints} onToggle={onToggleSection}>
                  {renderArrayContent(summary.chief_complaints)}
                </AccordionSection>
              )}
              {summary.treatment_suggested && (
                <AccordionSection title="Treatment Suggested" sectionKey="treatmentSuggested" expanded={!!expandedSections.treatmentSuggested} onToggle={onToggleSection}>
                  {renderTreatmentSuggested(summary.treatment_suggested)}
                </AccordionSection>
              )}
              {meds.length > 0 && (
                <AccordionSection title="Medications" sectionKey="medications" expanded={!!expandedSections.medications} onToggle={onToggleSection}>
                  {renderMedications(meds)}
                </AccordionSection>
              )}
              {summary.investigations && (
                <AccordionSection title="Investigations" sectionKey="investigations" expanded={!!expandedSections.investigations} onToggle={onToggleSection}>
                  {renderInvestigations(summary.investigations)}
                </AccordionSection>
              )}
              {summary.history && (
                <AccordionSection title="History" sectionKey="history" expanded={!!expandedSections.history} onToggle={onToggleSection}>
                  {renderArrayContent(summary.history)}
                </AccordionSection>
              )}
              {summary.followup_recommendations && (
                <AccordionSection title="Follow-up Recommendations" sectionKey="followupRecommendations" expanded={!!expandedSections.followupRecommendations} onToggle={onToggleSection}>
                  {renderArrayContent(summary.followup_recommendations)}
                </AccordionSection>
              )}
              {summary.key_personal_insights && (
                <AccordionSection title="Key Personal Insights" sectionKey="keyPersonalInsights" expanded={!!expandedSections.keyPersonalInsights} onToggle={onToggleSection}>
                  {renderArrayContent(summary.key_personal_insights)}
                </AccordionSection>
              )}
              {Array.isArray(summary.flags_for_review) && summary.flags_for_review.length > 0 && (
                <AccordionSection title="Flags for Review" sectionKey="flagsForReview" expanded={!!expandedSections.flagsForReview} onToggle={onToggleSection}>
                  <div className="space-y-2">
                    {summary.flags_for_review.map((flag, idx) => (
                      <div key={idx} className="bg-red-50 border border-red-200 rounded p-3">
                        <span className="text-red-800 font-medium">⚠ {flag}</span>
                      </div>
                    ))}
                  </div>
                </AccordionSection>
              )}
            </div>
          </>
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
          {isError
            ? 'Consultation summary failed'
            : `Preparing consultation summary: ${elapsed}s / ${ESTIMATED_PROCESS_SECONDS}s`}
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
