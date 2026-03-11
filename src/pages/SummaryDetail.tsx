import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Download } from 'lucide-react';
import { CreditCard as Edit } from 'lucide-react';
import Navbar from '../components/Navbar';
import Spinner from '../components/ui/Spinner';
import SummaryContent, { type SummaryJson } from '../components/features/clinical-summariser/SummaryContent';
import { getDischargeSummaryById, saveDischargeSummaryEdits, type DischargeSummaryRow } from '../lib/database';

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function SummaryDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [row, setRow] = useState<DischargeSummaryRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedJson, setEditedJson] = useState<SummaryJson>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    getDischargeSummaryById(id)
      .then((data) => {
        setRow(data);
        if (data?.summary_json) {
          setEditedJson(data.summary_json as SummaryJson);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleStartEdit = () => {
    if (row?.summary_json) {
      setEditedJson(row.summary_json as SummaryJson);
    }
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (row?.summary_json) {
      setEditedJson(row.summary_json as SummaryJson);
    }
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!id || !row) return;
    setIsSaving(true);
    try {
      const text = ((editedJson.patient_summary?.presenting_complaint || editedJson.patient_summary?.admitting_diagnosis) ?? '').slice(0, 200);
      await saveDischargeSummaryEdits(id, editedJson as unknown as Record<string, unknown>, text);
      setRow({ ...row, summary_json: editedJson as unknown as Record<string, unknown>, summary_text: text });
      setIsEditing(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = () => {
    if (!row?.summary_json) return;
    const blob = new Blob([JSON.stringify(row.summary_json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `discharge-summary-${id?.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar showBack />
        <div className="flex justify-center py-20"><Spinner size="md" /></div>
      </div>
    );
  }

  if (!row) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar showBack />
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <p className="text-gray-500">Summary not found.</p>
          <button onClick={() => navigate('/clinical-summariser')} className="btn-secondary text-sm">Back to list</button>
        </div>
      </div>
    );
  }

  const summaryJson = (row.summary_json as SummaryJson) || {};

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar showBack />

      <div className="w-full px-4 py-6 xl:px-[160px]">
        <nav className="text-xs text-gray-400 mb-4 flex items-center gap-1">
          <button onClick={() => navigate('/')} className="hover:text-[#024CDB] transition-colors">Main</button>
          <ChevronRight className="w-3 h-3" />
          <button onClick={() => navigate('/clinical-summariser')} className="hover:text-[#024CDB] transition-colors">Clinical Summariser</button>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-600">Summary</span>
        </nav>

        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Summary</h1>
            <p className="text-sm text-gray-400 mt-0.5">{formatDate(row.created_at)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isEditing ? (
              <>
                <button onClick={handleCancelEdit} className="btn-secondary text-sm">Cancel</button>
                <button onClick={handleSave} disabled={isSaving} className="btn-primary text-sm">
                  {isSaving ? 'Saving…' : 'Save'}
                </button>
              </>
            ) : (
              <>
                <button onClick={handleStartEdit} className="btn-secondary flex items-center gap-1.5 text-sm">
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
                <button onClick={handleDownload} className="btn-primary flex items-center gap-1.5 text-sm">
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </>
            )}
          </div>
        </div>

        {row.status === 'processing' && !row.summary_json ? (
          <div className="bg-white border border-gray-200 rounded-xl flex flex-col items-center justify-center py-20 gap-3">
            <Spinner size="md" />
            <p className="text-gray-500 text-sm">This summary is still being processed.</p>
          </div>
        ) : (
          <SummaryContent
            summary={summaryJson}
            isEditing={isEditing}
            edited={editedJson}
            onChange={setEditedJson}
          />
        )}

        {isEditing && (
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={handleCancelEdit} className="btn-secondary text-sm">Cancel</button>
            <button onClick={handleSave} disabled={isSaving} className="btn-primary text-sm">
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
