import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ChevronRight } from 'lucide-react';
import Navbar from '../components/Navbar';
import Spinner from '../components/ui/Spinner';
import { useAuth } from '../contexts/AuthContext';
import { getDischargeSummaries, type DischargeSummaryRow } from '../lib/database';

function StatusIndicator({ status }: { status: 'processing' | 'completed' }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-green-700">
        <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
        Completed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-gray-500">
      <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-pulse" />
      Processing…
    </span>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, ' ');
}

function truncate(text: string, max = 80) {
  if (!text) return '—';
  return text.length > max ? text.slice(0, max) + '…' : text;
}

function getSummarySnippet(row: DischargeSummaryRow): string {
  if (row.summary_text) return row.summary_text;
  if (row.summary_json) {
    const j = row.summary_json as Record<string, unknown>;
    const ps = j.patient_summary as Record<string, string> | undefined;
    if (ps?.presenting_complaint) return ps.presenting_complaint;
    if (ps?.admitting_diagnosis) return ps.admitting_diagnosis;
  }
  return '—';
}

export default function ClinicalSummariserList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summaries, setSummaries] = useState<DischargeSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    getDischargeSummaries(user.id)
      .then(setSummaries)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user?.id]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar showBack />

      <div className="w-full px-4 py-6 xl:px-[160px]">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-semibold text-gray-900">Clinical Summariser</h1>
          <button
            onClick={() => navigate('/clinical-summariser/new')}
            className="btn-primary flex items-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Summary
          </button>
        </div>


        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="md" />
          </div>
        ) : summaries.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl flex flex-col items-center justify-center py-20 gap-3">
            <p className="text-gray-500 text-sm">No summaries yet.</p>
            <button
              onClick={() => navigate('/clinical-summariser/new')}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" />
              Create your first summary
            </button>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 rounded-tl-xl w-32">Date</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Summary</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 w-36">Status</th>
                    <th className="px-4 py-3 rounded-tr-xl w-36" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {summaries.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => navigate(`/clinical-summariser/${row.id}`)}
                      className="group hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDate(row.created_at)}</td>
                      <td className="px-4 py-3 text-sm text-gray-800">{truncate(getSummarySnippet(row))}</td>
                      <td className="px-4 py-3"><StatusIndicator status={row.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-[#024CDB] font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          View Summary →
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {summaries.map((row) => (
                <div
                  key={row.id}
                  onClick={() => navigate(`/clinical-summariser/${row.id}`)}
                  className="bg-white border border-gray-200 rounded-lg px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400 mb-0.5">{formatDate(row.created_at)}</p>
                      <p className="text-sm text-gray-800 line-clamp-2">{truncate(getSummarySnippet(row), 100)}</p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <StatusIndicator status={row.status} />
                      <span className="text-xs text-[#024CDB] font-medium whitespace-nowrap">View →</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
