import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MessageSquare, Search } from 'lucide-react';
import Navbar from '../components/Navbar';
import PatientCard from '../components/PatientCard';
import Modal from '../components/Modal';
import { createPatient, getPatients, getPreConsults } from '../lib/database';

export default function MainPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [loading, setLoading] = useState(true);
  const [patientsWithPreConsult, setPatientsWithPreConsult] = useState<any[]>([]);
  const [allPatients, setAllPatients] = useState<any[]>([]);
  const [newPatient, setNewPatient] = useState({
    name: '',
    case: '',
    phone: '',
    age: '',
    gender: 'Male',
  });

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      setLoading(true);
      const patients = await getPatients();
      const today = new Date().toISOString().split('T')[0];

      const patientsWithTodayPreConsult = [];
      for (const patient of patients) {
        const preConsults = await getPreConsults(patient.id);
        const todaySubmitted = preConsults.find(pc =>
          pc.status === 'Submitted' &&
          pc.created_at.startsWith(today)
        );
        if (todaySubmitted) {
          patientsWithTodayPreConsult.push(patient);
        }
      }

      setPatientsWithPreConsult(patientsWithTodayPreConsult);
      setAllPatients(patients);
    } catch (error) {
      console.error('Error loading patients:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredListA = patientsWithPreConsult.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredListB = allPatients.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const handleAddPatient = async () => {
    try {
      await createPatient({
        name: newPatient.name,
        age: parseInt(newPatient.age),
        phone: newPatient.phone,
        case: newPatient.case || undefined,
        gender: newPatient.gender,
      });
      setShowAddPatient(false);
      setNewPatient({ name: '', case: '', phone: '', age: '', gender: 'Male' });
      await loadPatients();
    } catch (error) {
      console.error('Error creating patient:', error);
      alert('Failed to create patient');
    }
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
              {loading ? (
                <div className="col-span-full text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#024CDB] mx-auto"></div>
                </div>
              ) : (
                filteredListA.slice(0, 5).map((patient) => (
                  <div
                    key={patient.id}
                    onClick={() => navigate(`/patient/${patient.id}`)}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200 cursor-pointer hover:border-[#024CDB] group"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <h3 className="font-semibold text-lg text-gray-900 group-hover:text-[#024CDB] transition-colors">{patient.name}</h3>
                      {patient.case && (
                      <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-[#024CDB] mb-3">
                        {patient.case}
                      </div>
                    )}
                    
                    </div>
                    <div className="text-sm text-gray-500">
                        {patient.age}y, {patient.gender}
                      </div>
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      {patient.last_visit_at && (
                      <p className="text-sm text-gray-500">Last visit: {formatDate(patient.last_visit_at)}</p>
                    )}
                    </div>
                  </div>
                ))
              )}
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
              {loading ? (
                <div className="col-span-full text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#024CDB] mx-auto"></div>
                </div>
              ) : (
                filteredListB.slice(0, 5).map((patient) => (
                  <div
                    key={patient.id}
                    onClick={() => navigate(`/patient/${patient.id}`)}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200 cursor-pointer hover:border-[#024CDB] group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-lg text-gray-900 group-hover:text-[#024CDB] transition-colors">{patient.name}</h3>
                      <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {patient.age}y, {patient.gender}
                      </div>
                    </div>
                    {patient.case && (
                      <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-[#024CDB] mb-3">
                        {patient.case}
                      </div>
                    )}
                    {patient.last_visit_at && (
                      <p className="text-sm text-gray-500">Last visit: {formatDate(patient.last_visit_at)}</p>
                    )}
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-400">{patient.phone}</p>
                    </div>
                  </div>
                ))
              )}
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
