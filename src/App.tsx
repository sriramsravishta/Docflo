import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Login from './pages/Login';
import MainPage from './pages/MainPage';
import PatientProfile from './pages/PatientProfile';
import PreConsultForm from './pages/PreConsultForm';
import ClinicalSummariserList from './pages/ClinicalSummariserList';
import NewSummary from './pages/NewSummary';
import SummaryDetail from './pages/SummaryDetail';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><MainPage /></ProtectedRoute>} />
          <Route path="/patient/:patientId" element={<ProtectedRoute><PatientProfile /></ProtectedRoute>} />
          <Route path="/pre-consult/:preConsultId" element={<PreConsultForm />} />
          <Route path="/clinical-summariser" element={<ProtectedRoute><ClinicalSummariserList /></ProtectedRoute>} />
          <Route path="/clinical-summariser/new" element={<ProtectedRoute><NewSummary /></ProtectedRoute>} />
          <Route path="/clinical-summariser/:id" element={<ProtectedRoute><SummaryDetail /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
