import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MessageSquare, Search } from 'lucide-react';
import Navbar from '../components/Navbar';
import PatientCard from '../components/PatientCard';
import Modal from '../components/Modal';

const mockPatientsListA = [
  { id: '1', name: 'Rajesh Kumar', case: 'Hypertension', age: 45, gender: 'Male', lastVisit: '2025-10-03', completedToday: true },
  { id: '2', name: 'Priya Sharma', case: 'Diabetes', age: 38, gender: 'Female', lastVisit: '2025-10-02', completedToday: true },
];

const mockPatientsListB = [
  { id: '3', name: 'Amit Patel', case: 'Skin', age: 32, gender: 'Male', lastVisit: '2025-10-01' },
  { id: '4', name: 'Sunita Reddy', age: 28, gender: 'Female', lastVisit: '2025-09-30' },
  { id: '5', name: 'Vikram Singh', case: 'Hair', age: 41, gender: 'Male', lastVisit: '2025-09-28' },
];

export default function MainPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [newPatient, setNewPatient] = useState({
    name: '',
    case: '',
    phone: '',
    age: '',
    gender: 'Male',
  });

  const filteredListA = mockPatientsListA.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredListB = mockPatientsListB.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddPatient = () => {
    setShowAddPatient(false);
    setNewPatient({ name: '', case: '', phone: '', age: '', gender: 'Male' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search patients by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#024CDB] focus:border-transparent"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => navigate('/queries')}
              className="btn-secondary flex items-center space-x-2"
            >
              <MessageSquare className="w-5 h-5" />
              <span>Queries</span>
            </button>

            <button
              onClick={() => setShowAddPatient(true)}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Patient</span>
            </button>
          </div>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Today's Pre-consult Completed
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-3">
              {filteredListA.slice(0, 5).map((patient) => (
                <PatientCard key={patient.id} patient={patient} />
              ))}
            </div>
            {filteredListA.length > 5 && (
              <button className="text-[#024CDB] hover:underline text-sm font-medium">
                View all ({filteredListA.length})
              </button>
            )}
            {filteredListA.length === 0 && (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <p className="text-gray-500">No patients with completed pre-consults today</p>
              </div>
            )}
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              All Patients
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-3">
              {filteredListB.slice(0, 5).map((patient) => (
                <PatientCard key={patient.id} patient={patient} />
              ))}
            </div>
            {filteredListB.length > 5 && (
              <button className="text-[#024CDB] hover:underline text-sm font-medium">
                View all ({filteredListB.length})
              </button>
            )}
            {filteredListB.length === 0 && (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <p className="text-gray-500">No patients found</p>
              </div>
            )}
          </section>
        </div>
      </div>

      <Modal
        isOpen={showAddPatient}
        onClose={() => setShowAddPatient(false)}
        title="Add New Patient"
      >
        <form onSubmit={(e) => { e.preventDefault(); handleAddPatient(); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newPatient.name}
              onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
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
              value={newPatient.case}
              onChange={(e) => setNewPatient({ ...newPatient, case: e.target.value })}
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
              value={newPatient.phone}
              onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
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
                value={newPatient.age}
                onChange={(e) => setNewPatient({ ...newPatient, age: e.target.value })}
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gender <span className="text-red-500">*</span>
              </label>
              <select
                value={newPatient.gender}
                onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value })}
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
            <button type="button" onClick={() => setShowAddPatient(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Create
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
