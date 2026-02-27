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
      {patient.case && (
        <p className="text-sm text-[#024CDB] mt-1">{patient.case}</p>
      )}
      {patient.lastVisit && (
        <p className="text-sm text-gray-500 mt-1">Last visit: {patient.lastVisit}</p>
      )}
      <p className="text-sm text-gray-600 mt-2">
        {patient.age} yrs, {patient.gender}
      </p>
    </div>
  );
}
