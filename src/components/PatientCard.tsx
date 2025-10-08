import { useNavigate } from 'react-router-dom';

interface Patient {
  id: string;
  name: string;
  case?: string;
  lastVisit?: string;
  age: number;
  gender: string;
}

interface PatientCardProps {
  patient: Patient;
}

export default function PatientCard({ patient }: PatientCardProps) {
  const navigate = useNavigate();

  return (
    <div
      className="card"
      onClick={() => navigate(`/patient/${patient.id}`)}
    >
      <h3 className="font-semibold text-lg text-gray-900">{patient.name}</h3>

      {/* Age/Gender first */}
      <p className="text-sm text-gray-600 mt-1">
        {patient.age}y, {patient.gender}
      </p>

      {/* Case below */}
      {patient.case && (
        <p className="text-sm text-[#024CDB] mt-1">{patient.case}</p>
      )}

      {/* Last Visit */}
      {patient.lastVisit && (
        <p className="text-sm text-gray-500 mt-1">
          Last visit: {patient.lastVisit}
        </p>
      )}
    </div>
  );
}
