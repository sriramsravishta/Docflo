import { useState, useEffect } from 'react';
import { Phone, Calendar, User, MessageCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { LeadRow } from '../../types/db';
import Spinner from '../ui/Spinner';
import EmptyState from '../ui/EmptyState';

interface LeadsTabProps {
  docId: string;
  onCreateAppointment: (lead: LeadRow) => void;
}

export default function LeadsTab({ docId, onCreateAppointment }: LeadsTabProps) {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'All' | 'Dr. Sushma Peruri' | 'Dr. Prashanth Koyyoda'>('All');

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

  const filteredLeads = leads.filter(l => filter === 'All' || l.doctor_label === filter);

  if (loading) {
    return <div className="flex justify-center py-12"><Spinner size="md" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters (Segmented Control Style) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {['All', 'Dr. Sushma Peruri', 'Dr. Prashanth Koyyoda'].map((doc) => (
          <button
            key={doc}
            onClick={() => setFilter(doc as any)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border whitespace-nowrap ${
              filter === doc
                ? 'bg-[#024CDB] text-white border-[#024CDB]'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {doc}
          </button>
        ))}
      </div>

      {/* Table UI */}
      {filteredLeads.length === 0 ? (
        <EmptyState message="No leads found for this selection." />
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient Details</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Interest</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                    {/* Patient Details */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900">{lead.lead_name}</span>
                        <span className="text-xs text-gray-500 mt-0.5">{lead.source || 'Website'}</span>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          <a href={`tel:${lead.phone}`} className="hover:text-[#024CDB]">{lead.phone}</a>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-green-600">
                          <MessageCircle className="w-3.5 h-3.5" />
                          <a href={`https://wa.me/91${lead.phone.replace(/\D/g, '').slice(-10)}`} target="_blank" rel="noreferrer" className="hover:underline">
                            WhatsApp
                          </a>
                        </div>
                      </div>
                    </td>

                    {/* Interest */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1.5">
                        {lead.service && (
                          <div className="flex items-center gap-1.5 text-sm text-gray-600">
                            <User className="w-3.5 h-3.5 text-gray-400" />
                            <span className="truncate max-w-[150px]" title={lead.service}>{lead.service}</span>
                          </div>
                        )}
                        {(lead.preferred_date || lead.preferred_slot) && (
                          <div className="flex items-center gap-1.5 text-sm text-gray-600">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            <span>{lead.preferred_date} {lead.preferred_slot}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={lead.status}
                        onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                        className={`text-sm border-gray-200 rounded-lg shadow-sm focus:border-[#024CDB] focus:ring-[#024CDB] py-1.5 pl-3 pr-8 font-medium ${
                          lead.status === 'new' ? 'bg-blue-50 text-blue-700' :
                          lead.status === 'contacted' ? 'bg-yellow-50 text-yellow-700' :
                          lead.status === 'booked' ? 'bg-green-50 text-green-700' :
                          'bg-gray-50 text-gray-700'
                        }`}
                      >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="booked">Booked</option>
                        <option value="not_interested">Not Interested</option>
                      </select>
                    </td>

                    {/* Notes (Seamless Inline Input) */}
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        defaultValue={lead.notes || ''}
                        onBlur={(e) => {
                          if (e.target.value !== lead.notes) handleNoteSave(lead.id, e.target.value);
                        }}
                        placeholder="Add a note..."
                        className="w-full min-w-[200px] text-sm bg-transparent border border-transparent hover:border-gray-200 focus:bg-white focus:border-[#024CDB] focus:ring-1 focus:ring-[#024CDB] rounded px-2 py-1.5 transition-all"
                      />
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => onCreateAppointment(lead)}
                        className="inline-flex items-center justify-center px-3 py-1.5 border border-[#024CDB] text-[#024CDB] rounded-lg text-xs font-medium hover:bg-blue-50 transition-colors"
                      >
                        + Appointment
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}