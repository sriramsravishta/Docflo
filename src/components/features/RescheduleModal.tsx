import { useState } from 'react';
import Modal from '../Modal';
import Spinner from '../ui/Spinner';
import { toDatetimeLocalValue } from '../../lib/utils';

interface RescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName?: string;
  currentValue?: string | null;
  onSubmit: (isoDate: string) => Promise<boolean>;
}

export default function RescheduleModal({ isOpen, onClose, patientName, currentValue, onSubmit }: RescheduleModalProps) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const initial = value || (currentValue ? toDatetimeLocalValue(currentValue) : '');

  const handleSubmit = async () => {
    if (!initial || submitting) return;
    setSubmitting(true);
    const ok = await onSubmit(new Date(initial).toISOString());
    setSubmitting(false);
    if (ok) {
      setValue('');
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reschedule Appointment">
      <div className="space-y-4">
        {patientName && (
          <p className="text-sm text-gray-600">
            Choose a new date and time for <span className="font-medium text-gray-900">{patientName}</span>.
          </p>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date &amp; Time</label>
          <input
            type="datetime-local"
            value={initial}
            onChange={(e) => setValue(e.target.value)}
            className="input-field"
          />
        </div>
        <div className="flex space-x-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={submitting}>Cancel</button>
          <button type="button" onClick={handleSubmit} className="btn-primary flex items-center justify-center" disabled={submitting || !initial}>
            {submitting ? (<><Spinner size="sm" className="mr-2" />Saving...</>) : 'Reschedule'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
