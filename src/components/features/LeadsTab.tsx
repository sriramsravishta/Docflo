import { useState, useEffect } from 'react';
import { Phone, MessageCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { LeadRow } from '../../types/db';
import Spinner from '../ui/Spinner';

interface LeadsTabProps {
  docId: string;
  onCreateAppointment: (lead: LeadRow) => void;
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  booked: 'Booked',
  not_interested: 'Not Interested',
};

const STATUS_PILL: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-amber-100 text-amber-700',
  booked: 'bg-green-100 text-green-700',
  not_interested: 'bg-gray-200 text-gray-700',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function LeadsTab({ docId, onCreateAppointment }: LeadsTabProps) {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
    const [activeSubTab, setActiveSubTab] = useState<string>('All');

  useEffect(() => {
    fetchLeads();
  }, [docId]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('doc_id', docId)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', leadId);
      
      if (error) throw error;
      setLeads(leads.map(l => l.id === leadId ? { ...l, status: newStatus as any } : l));
    } catch (error) {
      console.error('Error updating lead status:', error);
    }
  };

  const handleNoteSave = async (leadId: string, notes: string) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ notes, updated_at: new Date().toISOString() })
        .eq('id', leadId);
        
      if (error) throw error;
      setLeads(leads.map(l => l.id === leadId ? { ...l, notes } : l));
    } catch (error) {
      console.error('Error updating lead notes:', error);
    }
  };

  const filtered = leads.filter(l => activeSubTab === 'All' || l.doctor_label === activeSubTab);

  const counts = {
    all: filtered.length,
    new: filtered.filter(l => l.status === 'new').length,
    contacted: filtered.filter(l => l.status === 'contacted').length,
    booked: filtered.filter(l => l.status === 'booked').length,
  };

    // Dynamically extract unique doctor names from the data
  const uniqueDoctors = Array.from(new Set(leads.map(l => l.doctor_label).filter(Boolean)));
  
  const subTabs = [
    { key: 'All', label: 'All Leads' },
    ...uniqueDoctors.map(doc => ({ 
      key: doc, 
      label: doc // Uses whatever label came from n8n dynamically
    }))
  ];

  return (
    <div className="space-y-4">
      {/* Sub-tabs row */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {subTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key as any)}
            className={`shrink-0 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
              activeSubTab === tab.key
                ? 'bg-[#024CDB] text-white border-[#024CDB]'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Stats strip */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-gray-200">
          <div className="flex-1 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Leads</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{counts.all}</p>
          </div>
          <div className="flex-1 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">New</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{counts.new}</p>
          </div>
          <div className="flex-1 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Contacted</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{counts.contacted}</p>
          </div>
          <div className="flex-1 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Booked</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{counts.booked}</p>
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="md" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-gray-500">No leads found for the selected filter</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Date</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Patient</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Contact</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Interest</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Notes</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {formatDate(row.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900 text-left">{row.lead_name}</p>
                        <p className="text-xs text-gray-500">{row.source || 'Website'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <a href={`tel:${row.phone}`} className="text-sm font-medium text-[#024CDB] hover:underline flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-gray-400" /> {row.phone}
                          </a>
                          <a href={`https://wa.me/91${row.phone.replace(/\D/g, '').slice(-10)}`} target="_blank" rel="noreferrer" className="text-xs text-green-600 hover:underline flex items-center gap-1.5">
                            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                          </a>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 max-w-[140px] truncate">
                        <p>{row.service || '—'}</p>
                        {(row.preferred_date || row.preferred_slot) && (
                          <p className="text-xs text-gray-500 mt-0.5">{row.preferred_date} {row.preferred_slot}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={row.status}
                          onChange={(e) => handleStatusChange(row.id, e.target.value)}
                          className={`text-xs font-semibold px-2 py-1 rounded-full border-0 outline-none cursor-pointer ${STATUS_PILL[row.status]}`}
                        >
                          {(Object.keys(STATUS_LABELS)).map((s) => (
                            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          defaultValue={row.notes || ''}
                          onBlur={(e) => { if (e.target.value !== (row.notes || '')) { handleNoteSave(row.id, e.target.value); } }}
                          className="text-sm text-gray-700 w-full bg-transparent border-0 border-b border-transparent hover:border-gray-300 focus:border-[#024CDB] focus:outline-none py-0.5 min-w-[120px]"
                          placeholder="Add notes…"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => onCreateAppointment(row)}
                          className="text-sm font-medium text-[#024CDB] hover:underline"
                        >
                          + Appt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards (mirrors SummaryTab styling) */}
          <div className="md:hidden space-y-3">
            {filtered.map((row) => (
              <div key={row.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900 text-left">{row.lead_name}</p>
                    <p className="text-xs text-gray-500">{row.source || 'Website'} · {formatDate(row.created_at)}</p>
                  </div>
                  <select
                    value={row.status}
                    onChange={(e) => handleStatusChange(row.id, e.target.value)}
                    className={`text-xs font-semibold px-2 py-1 rounded-full border-0 outline-none cursor-pointer shrink-0 ${STATUS_PILL[row.status]}`}
                  >
                    {(Object.keys(STATUS_LABELS)).map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Phone</p>
                    <a href={`tel:${row.phone}`} className="text-sm font-medium text-[#024CDB]">{row.phone}</a>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Interest</p>
                    <p className="text-sm text-gray-700 truncate">{row.service || '—'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 mb-0.5">Notes</p>
                    <input
                      type="text"
                      defaultValue={row.notes || ''}
                      onBlur={(e) => { if (e.target.value !== (row.notes || '')) { handleNoteSave(row.id, e.target.value); } }}
                      className="w-full text-sm text-gray-700 border-b border-gray-200 focus:border-[#024CDB] focus:outline-none bg-transparent"
                      placeholder="Add notes…"
                    />
                  </div>
                </div>
                
                <div className="pt-2">
                  <button
                    onClick={() => onCreateAppointment(row)}
                    className="w-full text-center py-2 border border-[#024CDB] text-[#024CDB] rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors"
                  >
                    Create Appointment
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}