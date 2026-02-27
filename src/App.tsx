import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Login from './pages/Login';
import MainPage from './pages/MainPage';
import QueriesPage from './pages/QueriesPage';
import PatientProfile from './pages/PatientProfile';
import ConsultSession from './pages/ConsultSession';
import PreConsultForm from './pages/PreConsultForm';
import FollowUpForm from './pages/FollowUpForm';
import PatientQueries from './pages/PatientQueries';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><MainPage /></ProtectedRoute>} />
          <Route path="/queries" element={<ProtectedRoute><QueriesPage /></ProtectedRoute>} />
          <Route path="/patient/:patientId" element={<ProtectedRoute><PatientProfile /></ProtectedRoute>} />
          <Route path="/consult/:patientId" element={<ProtectedRoute><ConsultSession /></ProtectedRoute>} />
          <Route path="/pre-consult/:preConsultId" element={<PreConsultForm />} />
          <Route path="/follow-up/:followUpId" element={<FollowUpForm />} />
          <Route path="/patient-queries/:patientId/:doctorId" element={<PatientQueries />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
