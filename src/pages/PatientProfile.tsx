import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CreditCard as Edit,
  Upload,
  ExternalLink,
  Send,
  Mic,
  Square,
  Clock,
  Pill,
  TrendingUp,
  FileText,
  AlertCircle
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/ConfirmationModal';
import {
  getPatientById,
  updatePatient,
  createPreConsult,
  getSummaries,
  getLatestSummary,
  createConsult,
  updateConsult,
  updatePreConsult
} from '../lib/database';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function PatientProfile() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [showEditModal, setShowEditModal] = useState(false);

  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationType, setConfirmationType] = useState<'send-link' | 'open-form' | 'upload-docs'>('send-link');

  const [documentsToUpload, setDocumentsToUpload] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  const [latestSummaryRow, setLatestSummaryRow] = useState<any>(null);
  const [pastSummaryRows, setPastSummaryRows] = useState<any[]>([]);

  const [selectedSummaryRow, setSelectedSummaryRow] = useState<any>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  const [activeTab, setActiveTab] = useState<'summary' | 'past-summaries'>('summary');

  const [editData, setEditData] = useState({
    name: '',
    age: '',
    phone: '',
    case: '',
    gender: 'Male',
  });

  useEffect(() => {
    if (patientId) {
      loadPatient();
      loadSummaries();
    }
  }, [patientId]);

  const loadPatient = async () => {
    try {
      setLoading(true);
      const data = await getPatientById(patientId!);
      setPatient(data);
      setEditData({
        name: data.name,
        age: data.age?.toString?.() ?? '',
        phone: data.phone ?? '',
        case: data.case || '',
        gender: data.gender ?? 'Male',
      });
    } catch (error) {
      console.error('Error loading patient:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSummaries = async () => {
    try {
      const [latest, all] = await Promise.all([
        getLatestSummary(patientId!),
        getSummaries(patientId!)
      ]);

      setLatestSummaryRow(latest || null);

      // If "all" is already sorted DESC, slice(1) works. If not, we still keep "latest" separate.
      const rest = Array.isArray(all) ? all.filter((x: any) => x?.id !== latest?.id) : [];
      setPastSummaryRows(rest);
    } catch (error) {
      console.error('Error loading summaries:', error);
      setLatestSummaryRow(null);
      setPastSummaryRows([]);
    }
  };

  const handleEditPatient = async () => {
    try {
      await updatePatient(patientId!, {
        name: editData.name,
        age: parseInt(editData.age),
        phone: editData.phone,
        case: editData.case || null,
        gender: editData.gender,
      });
      setShowEditModal(false);
      await loadPatient();
    } catch (error) {
      console.error('Error updating patient:', error);
      alert('Failed to update patient');
    }
  };

  const handleSendLink = async () => {
    try {
      const preConsult = await createPreConsult(user!.id, patientId!);
      const link = `${window.location.origin}/pre-consult/${preConsult.id}`;
      alert(`Pre-consult link created: ${link}`);
      setShowConfirmation(false);
    } catch (error) {
      console.error('Error creating pre-consult:', error);
      alert('Failed to create pre-consult link');
    }
  };

  const handleOpenForm = async () => {
    try {
      const preConsult = await createPreConsult(user!.id, patientId!);
      window.open(`/pre-consult/${preConsult.id}`, '_blank');
      setShowConfirmation(false);
    } catch (error) {
      console.error('Error creating pre-consult:', error);
      alert('Failed to open pre-consult form');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setDocumentsToUpload(Array.from(e.target.files));
      setUploadError('');
    }
  };

  const handleCloseDocumentUpload = () => {
    setShowDocumentUpload(false);
    setDocumentsToUpload([]);
    setUploadError('');
  };

  const confirmDocumentSubmit = async () => {
    if (documentsToUpload.length === 0) return;

    try {
      setIsUploading(true);
      setUploadError('');

      const preConsult = await createPreConsult(user!.id, patientId!);
      const uploadedUrls: string[] = [];

      for (const file of documentsToUpload) {
        const fileName = `${preConsult.id}-${Date.now()}-${file.name}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('pre-consultation-documents')
          .upload(fileName, file, {
            contentType: file.type || 'application/octet-stream',
            upsert: false,
            duplex: 'half'
          });

        if (uploadError) {
          console.error('Storage upload error:', uploadError);
          throw new Error(`Failed to upload document: ${file.name}`);
        }

        const { data: urlData } = supabase.storage
          .from('pre-consultation-documents')
          .getPublicUrl(uploadData.path);

        uploadedUrls.push(urlData.publicUrl);
      }

      await updatePreConsult(preConsult.id, {
        status: 'Submitted',
        documents_uploaded: uploadedUrls,
        ai_summary: null
      });

      handleCloseDocumentUpload();
      alert('Documents uploaded successfully!');

      // refresh summaries/patient if your pipeline creates/updates summary rows later
      await loadSummaries();
    } catch (error: any) {
      console.error('Error submitting documents:', error);
      setUploadError(error.message || 'Failed to upload documents');
    } finally {
      setIsUploading(false);
    }
  };

  const handleStartStopRecording = async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        const chunks: Blob[] = [];

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };

        recorder.onstop = async () => {
          const audioBlob = new Blob(chunks, { type: 'audio/webm' });
          await handleRecordingComplete(audioBlob);
          stream.getTracks().forEach(track => track.stop());
        };

        setMediaRecorder(recorder);
        recorder.start();
        setIsRecording(true);
        setRecordingTime(0);

        const interval = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
        (window as any).recordingInterval = interval;
      } catch (error) {
        console.error('Error starting recording:', error);
        alert('Failed to start recording. Please check microphone permissions.');
      }
    } else {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
      setIsRecording(false);
      clearInterval((window as any).recordingInterval);
    }
  };

  const handleRecordingComplete = async (audioBlob: Blob) => {
    try {
      const fileName = `consultation-${patientId}-${Date.now()}.webm`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('consultation-recordings')
        .upload(fileName, audioBlob, {
          contentType: 'audio/webm',
          upsert: false
        });

      if (uploadError) throw new Error('Failed to upload recording');

      const { data: urlData } = supabase.storage
        .from('consultation-recordings')
        .getPublicUrl(uploadData.path);

      const consult = await createConsult(user!.id, patientId!, urlData.publicUrl);

      await updateConsult(consult.id, {
        recording_transcript: 'Recording completed and saved.',
        consult_summary_ai: {
          diagnosis: 'Consultation recorded',
          history: 'Audio recording completed successfully',
          chief_complaints: 'Recording saved for analysis',
          treatment_suggested: 'Review recording for treatment plan',
          medications: [],
          key_personal_insights: 'Recording available for review',
          followup_recommendations: 'Analyze recording and provide follow-up'
        }
      });

      setRecordingTime(0);
      alert('Recording saved successfully!');

      // If your backend generates a new “final summary” after consult, refresh:
      await loadSummaries();
    } catch (error) {
      console.error('Error saving recording:', error);
      alert('Failed to save recording');
    }
  };

  const handleConfirmAction = () => {
    switch (confirmationType) {
      case 'send-link':
        handleSendLink();
        break;
      case 'open-form':
        handleOpenForm();
        break;
      case 'upload-docs':
        setShowConfirmation(false);
        setShowDocumentUpload(true);
        break;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return (
      date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) +
      ' at ' +
      date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    );
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ----------------------------
  // Summary helpers (UPDATED)
  // ----------------------------
  const normalizeJson = (raw: any) => {
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    if (typeof raw === 'string') {
      const s = raw.trim();
      if (!s) return null;
      try { return JSON.parse(s); } catch { return raw; }
    }
    return raw;
  };

  // In your summaries table, the JSONB is usually in row.summary
  // but sometimes your code might already pass the JSON directly.
  const getSummaryJsonFromRow = (row: any) => {
    if (!row) return null;
    const fromCol = normalizeJson(row.summary);
    if (fromCol && typeof fromCol === 'object') return fromCol;
    const maybeDirect = normalizeJson(row);
    if (maybeDirect && typeof maybeDirect === 'object' && (maybeDirect.sections || maybeDirect.overview)) return maybeDirect;
    return fromCol || maybeDirect || null;
  };

  const summaryJsonLatest = useMemo(() => getSummaryJsonFromRow(latestSummaryRow), [latestSummaryRow]);

  const priorityBadge = (priority?: string) => {
    const p = (priority || '').toLowerCase();
    const cls =
      p === 'high'
        ? 'bg-red-50 text-red-700 border-red-200'
        : p === 'medium'
          ? 'bg-amber-50 text-amber-700 border-amber-200'
          : p === 'low'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-gray-50 text-gray-700 border-gray-200';

    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${cls}`}>
        Priority: {priority || 'Unknown'}
      </span>
    );
  };

  const SectionShell = ({ title, icon, children, defaultOpen = true }: any) => (
    <details className="border border-gray-200 rounded-lg bg-white" open={defaultOpen}>
      <summary className="cursor-pointer select-none px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold text-gray-900">{title}</span>
        </div>
        <span className="text-xs text-gray-500">Expand/Collapse</span>
      </summary>
      <div className="px-4 pb-4 pt-1">{children}</div>
    </details>
  );

  // lightweight markdown-ish rendering (headings + bullets + bold)
  const renderMarkdownLite = (text: string) => {
    const lines = (text || '').split('\n');
    return (
      <div className="space-y-2">
        {lines.map((line, idx) => {
          const l = line.trimEnd();
          if (l.startsWith('### ')) return <h4 key={idx} className="text-sm font-semibold text-gray-900">{l.replace(/^###\s*/, '')}</h4>;
          if (l.startsWith('## ')) return <h3 key={idx} className="text-base font-semibold text-gray-900">{l.replace(/^##\s*/, '')}</h3>;
          if (l.startsWith('# ')) return <h2 key={idx} className="text-lg font-semibold text-gray-900">{l.replace(/^#\s*/, '')}</h2>;

          if (l.startsWith('- ')) {
            const content = l.replace(/^-+\s*/, '');
            return (
              <div key={idx} className="flex gap-2">
                <div className="pt-1 text-gray-400">•</div>
                <p className="text-sm text-gray-800 leading-relaxed break-words">{content}</p>
              </div>
            );
          }

          if (!l.trim()) return <div key={idx} />;

          // Bold segments **text**
          const parts: any[] = [];
          let rest = l;
          while (rest.includes('**')) {
            const start = rest.indexOf('**');
            const end = rest.indexOf('**', start + 2);
            if (end === -1) break;
            const before = rest.slice(0, start);
            const bold = rest.slice(start + 2, end);
            if (before) parts.push(<span key={`${idx}-b-${parts.length}`}>{before}</span>);
            parts.push(<strong key={`${idx}-b-${parts.length}`} className="font-semibold">{bold}</strong>);
            rest = rest.slice(end + 2);
          }
          if (rest) parts.push(<span key={`${idx}-b-${parts.length}`}>{rest}</span>);

          return (
            <p key={idx} className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
              {parts.length ? parts : l}
            </p>
          );
        })}
      </div>
    );
  };

  // Trend table: show multiple measurements over time
  const TrendBlock = ({ trend }: any) => {
    const name = trend?.parameter_name || 'Parameter';
    const unit = trend?.unit || '';
    const nr = trend?.normal_range || '';
    const comment = trend?.overall_trend_comment || '';
    const measurements = Array.isArray(trend?.measurements) ? trend.measurements : [];

    // sort by measurement_datetime if possible (safe)
    const sorted = [...measurements].sort((a: any, b: any) => {
      const ad = new Date(a?.measurement_datetime || 0).getTime();
      const bd = new Date(b?.measurement_datetime || 0).getTime();
      return ad - bd;
    });

    return (
      <div className="border border-gray-200 rounded-lg bg-gray-50 p-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-gray-900">{name}</p>
            <p className="text-xs text-gray-600 mt-1">
              {nr ? `Normal: ${nr}` : 'Normal: —'}{unit ? ` • Unit: ${unit}` : ''}
            </p>
            {comment ? <p className="text-xs text-gray-700 mt-2">{comment}</p> : null}
          </div>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-2 pr-4 font-medium">Time</th>
                <th className="py-2 pr-4 font-medium">Value</th>
                <th className="py-2 pr-4 font-medium">Interpretation</th>
              </tr>
            </thead>
            <tbody className="text-gray-800">
              {sorted.length === 0 ? (
                <tr>
                  <td className="py-2 pr-4" colSpan={3}>No measurements</td>
                </tr>
              ) : (
                sorted.map((m: any, idx: number) => (
                  <tr key={idx} className="border-t border-gray-200">
                    <td className="py-2 pr-4 whitespace-nowrap text-gray-600">{m?.measurement_datetime || '—'}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {m?.value_raw ?? (m?.value_numeric !== null && m?.value_numeric !== undefined ? String(m.value_numeric) : '—')}
                      {unit ? ` ${unit}` : ''}
                    </td>
                    <td className="py-2 pr-4">{m?.clinical_interpretation || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderFinalSummary = (row: any) => {
    const s = getSummaryJsonFromRow(row);
    if (!s || typeof s !== 'object') {
      return <p className="text-gray-500">No summary available</p>;
    }

    const overview = s.overview || {};
    const sections = s.sections || {};
    const rollups = sections.clinical_rollups || {};

    const oneLiner = overview.one_liner || '';
    const priority = overview.priority || '';
    const confidenceNotes = Array.isArray(overview.confidence_notes) ? overview.confidence_notes : [];
    const doctorTodo = Array.isArray(overview.doctor_todo) ? overview.doctor_todo : [];

    const pre = sections.preconsult_digest?.latest || {};
    const consult = sections.consultation_digest?.latest || {};
    const follow = sections.followup_digest?.latest || {};
    const queries = sections.queries_digest || {};

    const preOverall = pre.overall_summary_markdown || '';
    const preMeds = Array.isArray(pre.medication_summary) ? pre.medication_summary : [];
    const preTrends = Array.isArray(pre.diagnostic_trends) ? pre.diagnostic_trends : [];
    const preTimeline = Array.isArray(pre.timeline_of_medical_events) ? pre.timeline_of_medical_events : [];

    const problems = Array.isArray(rollups.problem_list) ? rollups.problem_list : [];
    const currentMeds = Array.isArray(rollups.current_medications) ? rollups.current_medications : [];
    const keyTrends = Array.isArray(rollups.key_trends) ? rollups.key_trends : [];
    const riskFlags = Array.isArray(rollups.risk_flags) ? rollups.risk_flags : [];
    const nextVisit = Array.isArray(rollups.next_visit_focus) ? rollups.next_visit_focus : [];

    const latestThreads = Array.isArray(queries.latest_threads) ? queries.latest_threads : [];
    const openCount = typeof queries.open_count === 'number' ? queries.open_count : undefined;

    return (
      <div className="space-y-4">
        {/* Header overview (minimal color) */}
        <div className="border border-gray-200 rounded-lg bg-gray-50 p-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">At-a-glance</p>
              {oneLiner ? (
                <p className="text-sm text-gray-800 mt-2 leading-relaxed">{oneLiner}</p>
              ) : (
                <p className="text-sm text-gray-500 mt-2">No one-liner available</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {priority ? priorityBadge(priority) : null}
                {s.schema_version ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-gray-200 bg-white text-gray-700">
                    {s.schema_version}
                  </span>
                ) : null}
                {s.generated_at ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-gray-200 bg-white text-gray-600">
                    Generated: {String(s.generated_at)}
                  </span>
                ) : null}
              </div>
            </div>

            {(doctorTodo.length > 0 || confidenceNotes.length > 0) && (
              <div className="w-full sm:w-[340px]">
                <div className="border border-gray-200 rounded-lg bg-white p-3">
                  <p className="text-xs font-semibold text-gray-900">Doctor Focus</p>

                  {doctorTodo.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[11px] text-gray-500 font-medium">Next visit focus</p>
                      <ul className="mt-1 space-y-1">
                        {doctorTodo.slice(0, 5).map((t: string, idx: number) => (
                          <li key={idx} className="text-xs text-gray-800">• {t}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {confidenceNotes.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[11px] text-gray-500 font-medium">Needs confirmation</p>
                      <ul className="mt-1 space-y-1">
                        {confidenceNotes.slice(0, 4).map((n: string, idx: number) => (
                          <li key={idx} className="text-xs text-gray-700">• {n}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Collapsibles */}
        <div className="space-y-3">
          <SectionShell
            title="Clinical Rollup"
            icon={<TrendingUp className="w-4 h-4 text-gray-600" />}
            defaultOpen
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="border border-gray-200 rounded-lg p-3 bg-white">
                <p className="text-xs font-semibold text-gray-900 mb-2">Problem List</p>
                {problems.length === 0 ? (
                  <p className="text-sm text-gray-500">No problems listed</p>
                ) : (
                  <div className="space-y-2">
                    {problems.map((p: any, idx: number) => (
                      <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-gray-900">{p?.name || 'Problem'}</p>
                          <span className="text-xs text-gray-600 border border-gray-200 bg-white rounded-full px-2 py-0.5">
                            {p?.status || '—'}
                          </span>
                        </div>
                        {Array.isArray(p?.evidence) && p.evidence.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {p.evidence.slice(0, 4).map((e: string, i: number) => (
                              <li key={i} className="text-xs text-gray-700">• {e}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border border-gray-200 rounded-lg p-3 bg-white">
                <p className="text-xs font-semibold text-gray-900 mb-2">Current Medications (merged)</p>
                {currentMeds.length === 0 ? (
                  <p className="text-sm text-gray-500">No medications available</p>
                ) : (
                  <div className="space-y-2">
                    {currentMeds.map((m: any, idx: number) => (
                      <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                        <p className="text-sm font-semibold text-gray-900">{m?.name || 'Medication'}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          {m?.status ? `Status: ${m.status}` : 'Status: —'}
                          {m?.source ? ` • Source: ${m.source}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="border border-gray-200 rounded-lg p-3 bg-white">
                <p className="text-xs font-semibold text-gray-900 mb-2">Key Trends (latest)</p>
                {keyTrends.length === 0 ? (
                  <p className="text-sm text-gray-500">No key trends</p>
                ) : (
                  <div className="space-y-2">
                    {keyTrends.map((t: any, idx: number) => (
                      <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                        <p className="text-sm font-semibold text-gray-900">{t?.parameter_name || 'Trend'}</p>
                        <p className="text-xs text-gray-700 mt-1">
                          {t?.latest_value || '—'}{t?.latest_when ? ` • ${t.latest_when}` : ''}
                        </p>
                        {t?.trend_comment ? <p className="text-xs text-gray-600 mt-1">{t.trend_comment}</p> : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border border-gray-200 rounded-lg p-3 bg-white">
                <p className="text-xs font-semibold text-gray-900 mb-2">Risk Flags</p>
                {riskFlags.length === 0 ? (
                  <p className="text-sm text-gray-500">No risk flags</p>
                ) : (
                  <div className="space-y-2">
                    {riskFlags.map((r: any, idx: number) => {
                      const sev = (r?.severity || '').toLowerCase();
                      const sevCls =
                        sev === 'high'
                          ? 'border-red-200 bg-red-50 text-red-800'
                          : sev === 'medium'
                            ? 'border-amber-200 bg-amber-50 text-amber-800'
                            : 'border-gray-200 bg-gray-50 text-gray-800';

                      return (
                        <div key={idx} className={`border rounded-lg p-3 ${sevCls}`}>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold">{r?.label || 'Flag'}</p>
                            <span className="text-xs border border-white/40 bg-white/60 rounded-full px-2 py-0.5">
                              {r?.severity || '—'}
                            </span>
                          </div>
                          {r?.why ? <p className="text-xs mt-1">{r.why}</p> : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {nextVisit.length > 0 && (
              <div className="mt-3 border border-gray-200 rounded-lg p-3 bg-white">
                <p className="text-xs font-semibold text-gray-900 mb-2">Next Visit Focus</p>
                <ul className="space-y-1">
                  {nextVisit.slice(0, 8).map((x: string, idx: number) => (
                    <li key={idx} className="text-sm text-gray-800">• {x}</li>
                  ))}
                </ul>
              </div>
            )}
          </SectionShell>

          <SectionShell
            title="Pre-consult AI Summary"
            icon={<FileText className="w-4 h-4 text-gray-600" />}
            defaultOpen
          >
            {preOverall ? (
              <div className="border border-gray-200 rounded-lg bg-gray-50 p-4">
                {renderMarkdownLite(preOverall)}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No pre-consult overall summary available</p>
            )}

            {preMeds.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-gray-900 mb-2">Medication Summary (from documents)</p>
                <div className="space-y-2">
                  {preMeds.map((m: any, idx: number) => (
                    <div key={idx} className="border border-gray-200 rounded-lg bg-white p-3">
                      <p className="text-sm font-semibold text-gray-900">{m?.drug_name || m?.name || `Medication ${idx + 1}`}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {[
                          m?.dose && `Dose: ${m.dose}`,
                          m?.route && `Route: ${m.route}`,
                          m?.frequency && `Freq: ${m.frequency}`,
                          m?.duration_or_quantity && `Duration/Qty: ${m.duration_or_quantity}`
                        ].filter(Boolean).join(' • ')}
                      </p>
                      {m?.indication ? <p className="text-xs text-gray-700 mt-2">{m.indication}</p> : null}
                      {m?.additional_notes ? <p className="text-xs text-gray-500 mt-2">{m.additional_notes}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {preTrends.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-gray-900 mb-2">Diagnostic Trends (over time)</p>
                <div className="space-y-3">
                  {preTrends.map((t: any, idx: number) => (
                    <TrendBlock key={idx} trend={t} />
                  ))}
                </div>
              </div>
            )}

            {preTimeline.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-gray-900 mb-2">Timeline of Medical Events</p>
                <div className="space-y-2">
                  {preTimeline.map((e: any, idx: number) => (
                    <div key={idx} className="border border-gray-200 rounded-lg bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{e?.event_type || `Event ${idx + 1}`}</p>
                          <p className="text-xs text-gray-600 mt-1">
                            {e?.location ? e.location : '—'}
                            {e?.cardiac_focus ? ` • ${e.cardiac_focus}` : ''}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500 whitespace-nowrap">{e?.event_datetime || '—'}</p>
                      </div>
                      {e?.summary ? <p className="text-xs text-gray-800 mt-2 whitespace-pre-wrap">{e.summary}</p> : null}
                      {e?.important_findings ? (
                        <p className="text-xs text-gray-600 mt-2 whitespace-pre-wrap">{e.important_findings}</p>
                      ) : null}
                      {e?.source_reference ? (
                        <p className="text-[11px] text-gray-500 mt-2">Source: {e.source_reference}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SectionShell>

          <SectionShell
            title="Consultation Summary"
            icon={<Mic className="w-4 h-4 text-gray-600" />}
            defaultOpen={false}
          >
            {!consult || Object.keys(consult).length === 0 ? (
              <p className="text-sm text-gray-500">No consultation summary available</p>
            ) : (
              <div className="space-y-3">
                <div className="border border-gray-200 rounded-lg bg-gray-50 p-4">
                  <p className="text-xs text-gray-500">When</p>
                  <p className="text-sm text-gray-900 font-semibold">{consult?.when || '—'}</p>

                  {Array.isArray(consult?.diagnosis) && consult.diagnosis.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-gray-900">Diagnosis</p>
                      <ul className="mt-1 space-y-1">
                        {consult.diagnosis.map((d: string, idx: number) => (
                          <li key={idx} className="text-sm text-gray-800">• {d}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {consult?.history && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-gray-900">History</p>
                      <p className="text-sm text-gray-800 mt-1 whitespace-pre-wrap">{consult.history}</p>
                    </div>
                  )}

                  {Array.isArray(consult?.chief_complaints) && consult.chief_complaints.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-gray-900">Chief Complaints</p>
                      <ul className="mt-1 space-y-1">
                        {consult.chief_complaints.map((c: string, idx: number) => (
                          <li key={idx} className="text-sm text-gray-800">• {c}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {Array.isArray(consult?.treatment_plan) && consult.treatment_plan.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-gray-900">Treatment Plan</p>
                      <ul className="mt-1 space-y-1">
                        {consult.treatment_plan.map((t: string, idx: number) => (
                          <li key={idx} className="text-sm text-gray-800">• {t}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {Array.isArray(consult?.medications) && consult.medications.length > 0 && (
                  <div className="border border-gray-200 rounded-lg bg-white p-4">
                    <p className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <Pill className="w-4 h-4 text-gray-600" />
                      Medications (from consult)
                    </p>
                    <div className="space-y-2">
                      {consult.medications.map((m: any, idx: number) => (
                        <div key={idx} className="border border-gray-200 rounded-lg bg-gray-50 p-3">
                          <p className="text-sm font-semibold text-gray-900">{m?.name || `Medication ${idx + 1}`}</p>
                          <p className="text-xs text-gray-600 mt-1">
                            {[
                              m?.frequency && `Freq: ${m.frequency}`,
                              m?.duration && `Duration: ${m.duration}`,
                              m?.timing && `Timing: ${m.timing}`
                            ].filter(Boolean).join(' • ')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {consult?.followup_instructions && Array.isArray(consult.followup_instructions) && consult.followup_instructions.length > 0 && (
                  <div className="border border-gray-200 rounded-lg bg-white p-4">
                    <p className="text-xs font-semibold text-gray-900 mb-2">Follow-up Instructions</p>
                    <ul className="space-y-1">
                      {consult.followup_instructions.map((x: string, idx: number) => (
                        <li key={idx} className="text-sm text-gray-800">• {x}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </SectionShell>

          <SectionShell
            title="Follow-up Summary"
            icon={<Clock className="w-4 h-4 text-gray-600" />}
            defaultOpen={false}
          >
            {!follow || Object.keys(follow).length === 0 ? (
              <p className="text-sm text-gray-500">No follow-up summary available</p>
            ) : (
              <div className="space-y-3">
                <div className="border border-gray-200 rounded-lg bg-gray-50 p-4">
                  <p className="text-xs text-gray-500">When</p>
                  <p className="text-sm text-gray-900 font-semibold">{follow?.when || '—'}</p>

                  {follow?.summary_markdown ? (
                    <div className="mt-3">{renderMarkdownLite(follow.summary_markdown)}</div>
                  ) : (
                    <p className="text-sm text-gray-500 mt-2">No follow-up text</p>
                  )}
                </div>

                {Array.isArray(follow?.red_flags) && follow.red_flags.length > 0 && (
                  <div className="border border-gray-200 rounded-lg bg-white p-4">
                    <p className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-gray-600" />
                      Red Flags
                    </p>
                    <ul className="space-y-1">
                      {follow.red_flags.map((x: string, idx: number) => (
                        <li key={idx} className="text-sm text-gray-800">• {x}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </SectionShell>

          <SectionShell
            title="Queries Summary"
            icon={<Send className="w-4 h-4 text-gray-600" />}
            defaultOpen={false}
          >
            <div className="border border-gray-200 rounded-lg bg-gray-50 p-4">
              <p className="text-sm text-gray-900 font-semibold">
                {typeof openCount === 'number' ? `${openCount} open queries` : 'Queries'}
              </p>
              <p className="text-xs text-gray-600 mt-1">Latest threads (tap a past summary card to open full snapshot)</p>

              {latestThreads.length === 0 ? (
                <p className="text-sm text-gray-500 mt-3">No queries available</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {latestThreads.slice(0, 5).map((q: any, idx: number) => (
                    <div key={idx} className="border border-gray-200 rounded-lg bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{q?.topic || 'Query'}</p>
                          <p className="text-xs text-gray-600 mt-1">
                            {q?.when ? q.when : '—'}
                            {q?.status ? ` • ${q.status}` : ''}
                            {q?.priority ? ` • ${q.priority}` : ''}
                          </p>
                        </div>
                      </div>
                      {q?.thread_summary_markdown ? (
                        <div className="mt-2">{renderMarkdownLite(q.thread_summary_markdown)}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionShell>

          {/* Raw JSON (doctor / debug) */}
          <details className="border border-gray-200 rounded-lg bg-white">
            <summary className="cursor-pointer select-none px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">View full JSON</span>
              <span className="text-xs text-gray-500">Expand/Collapse</span>
            </summary>
            <div className="px-4 pb-4">
              <pre className="text-xs text-gray-700 overflow-auto whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded-lg p-3">
                {JSON.stringify(s, null, 2)}
              </pre>
            </div>
          </details>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar showBack />
        <div className="max-w-5xl mx-auto px-4 py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#024CDB] mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar showBack />
        <div className="max-w-5xl mx-auto px-4 py-12">
          <div className="text-center">
            <p className="text-gray-500">Patient not found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar showBack />

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Patient Info Container */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{patient.name}</h1>
                  <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                    <span>{patient.age} years</span>
                    <span>{patient.gender}</span>
                    <span>{patient.phone}</span>
                  </div>
                  {patient.case && (
                    <div className="mt-2">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 border border-gray-200">
                        {patient.case}
                      </span>
                    </div>
                  )}
                  {patient.last_visit_at && (
                    <p className="text-sm text-gray-500 mt-2">
                      Last visit: {formatDate(patient.last_visit_at)}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowEditModal(true)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Edit patient"
                >
                  <Edit className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 lg:flex-col xl:flex-row">
              <button
                onClick={() => {
                  setConfirmationType('upload-docs');
                  setShowConfirmation(true);
                }}
                className="btn-secondary flex items-center justify-center space-x-2"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Documents</span>
              </button>

              <button
                onClick={() => {
                  setConfirmationType('open-form');
                  setShowConfirmation(true);
                }}
                className="btn-secondary flex items-center justify-center space-x-2"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open Form</span>
              </button>

              <button
                onClick={() => {
                  setConfirmationType('send-link');
                  setShowConfirmation(true);
                }}
                className="btn-secondary flex items-center justify-center space-x-2"
              >
                <Send className="w-4 h-4" />
                <span>Send Link</span>
              </button>

              <button
                onClick={handleStartStopRecording}
                className={`flex items-center justify-center space-x-2 font-medium py-2 px-4 rounded-lg transition-colors ${
                  isRecording
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-[#024CDB] hover:bg-[#023BA3] text-white'
                }`}
              >
                {isRecording ? (
                  <>
                    <Square className="w-4 h-4" />
                    <span>Stop ({formatTime(recordingTime)})</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    <span>Start Consultation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Summary Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('summary')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'summary'
                    ? 'border-[#024CDB] text-[#024CDB]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Summary
              </button>
              <button
                onClick={() => setActiveTab('past-summaries')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'past-summaries'
                    ? 'border-[#024CDB] text-[#024CDB]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Past Summaries
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'summary' && (
              <div>
                {latestSummaryRow ? (
                  renderFinalSummary(latestSummaryRow)
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No summary available yet</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'past-summaries' && (
              <div>
                {pastSummaryRows.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pastSummaryRows.map((row: any) => (
                      <div
                        key={row.id}
                        onClick={() => {
                          setSelectedSummaryRow(row);
                          setShowSummaryModal(true);
                        }}
                        className="border border-gray-200 rounded-lg bg-white p-4 hover:shadow-sm transition cursor-pointer"
                      >
                        <div className="flex items-center text-sm text-gray-600 mb-1">
                          <Clock className="w-4 h-4 mr-2 text-gray-500" />
                          {formatDate(row.created_at)}
                        </div>
                        <p className="text-xs text-gray-500">Tap to open full snapshot</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No past summaries available</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Patient Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Patient"
      >
        <form onSubmit={(e) => { e.preventDefault(); handleEditPatient(); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={editData.name}
              onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Case (optional)
            </label>
            <input
              type="text"
              value={editData.case}
              onChange={(e) => setEditData({ ...editData, case: e.target.value })}
              className="input-field"
              placeholder="e.g., Hypertension, Diabetes"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={editData.phone}
              onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
              className="input-field"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Age <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={editData.age}
                onChange={(e) => setEditData({ ...editData, age: e.target.value })}
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gender <span className="text-red-500">*</span>
              </label>
              <select
                value={editData.gender}
                onChange={(e) => setEditData({ ...editData, gender: e.target.value })}
                className="input-field"
                required
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="flex space-x-3 justify-end pt-4">
            <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* Document Upload Modal */}
      <Modal
        isOpen={showDocumentUpload}
        onClose={handleCloseDocumentUpload}
        title="Upload Documents"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Upload medical documents, prescriptions, or reports for this patient.
          </p>

          <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
            <Upload className="w-12 h-12 text-gray-400 mb-2" />
            <span className="text-gray-600">Click to upload files</span>
            <input
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>

          {documentsToUpload.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">
                {documentsToUpload.length} file(s) selected:
              </p>
              {documentsToUpload.map((file, idx) => (
                <div key={idx} className="flex items-center text-sm text-gray-600 bg-gray-50 rounded px-3 py-2">
                  <span className="mr-2">📎</span>
                  <span className="flex-1">{file.name}</span>
                  <span className="text-xs text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                </div>
              ))}
            </div>
          )}

          {uploadError && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              {uploadError}
            </div>
          )}

          <div className="flex space-x-3 justify-end pt-4">
            <button onClick={handleCloseDocumentUpload} className="btn-secondary">
              Cancel
            </button>
            <button
              onClick={confirmDocumentSubmit}
              disabled={documentsToUpload.length === 0 || isUploading}
              className="btn-primary disabled:opacity-50"
            >
              {isUploading ? 'Uploading...' : 'Upload Documents'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Summary Modal (popup) */}
      <Modal
        isOpen={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        title={`Summary - ${selectedSummaryRow ? formatDate(selectedSummaryRow.created_at) : ''}`}
      >
        {selectedSummaryRow ? renderFinalSummary(selectedSummaryRow) : null}
      </Modal>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleConfirmAction}
        title={
          confirmationType === 'send-link' ? 'Send Pre-consult Link' :
          confirmationType === 'open-form' ? 'Open Pre-consult Form' :
          'Upload Documents'
        }
        message={
          confirmationType === 'send-link' ? 'Create and display a pre-consult link for this patient?' :
          confirmationType === 'open-form' ? 'Open the pre-consult form in a new window?' :
          'Upload documents for this patient?'
        }
      />
    </div>
  );
}
