import { useParams } from 'react-router-dom';

export default function PrescriptionPage() {
  const { token } = useParams<{ token: string }>();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-gray-600">Loading prescription…</p>
        <p className="text-sm text-gray-400 mt-2">Token: {token}</p>
      </div>
    </div>
  );
}
