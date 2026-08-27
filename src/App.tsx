import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { FeatureFlagsProvider } from './contexts/FeatureFlagsContext';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import MainPage from './pages/MainPage';
import PatientProfile from './pages/PatientProfile';
import PreConsultForm from './pages/PreConsultForm';
import ClinicalSummariserList from './pages/ClinicalSummariserList';
import NewSummary from './pages/NewSummary';
import SummaryDetail from './pages/SummaryDetail';
import FavouritesPage from './pages/FavouritesPage';
import ProtectedRoute from './components/ProtectedRoute';

// Pharmacy pages
// import PharmacyDashboard from './pages/pharmacy/PharmacyDashboard';
// import DispenseScreen from './pages/pharmacy/DispenseScreen';
// import InventoryPage from './pages/pharmacy/InventoryPage';
// import BillsPage from './pages/pharmacy/BillsPage';
// import PharmacyNav from './components/pharmacy/PharmacyNav';

function DoctorRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><MainPage /></ProtectedRoute>} />
      <Route path="/patient/:patientId" element={<ProtectedRoute><PatientProfile /></ProtectedRoute>} />
      <Route path="/pre-consult/:preConsultId" element={<PreConsultForm />} />
      <Route path="/clinical-summariser" element={<ProtectedRoute><ClinicalSummariserList /></ProtectedRoute>} />
      <Route path="/clinical-summariser/new" element={<ProtectedRoute><NewSummary /></ProtectedRoute>} />
      <Route path="/clinical-summariser/:id" element={<ProtectedRoute><SummaryDetail /></ProtectedRoute>} />
      <Route path="/favorites" element={<ProtectedRoute><FavouritesPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function PharmacyRoutes() {
  return (
    <>
      <PharmacyNav />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><PharmacyDashboard /></ProtectedRoute>} />
        <Route path="/dispense/:consultId" element={<ProtectedRoute><DispenseScreen /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
        <Route path="/bills" element={<ProtectedRoute><BillsPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

function AppRoutes() {
  const { user, role } = useAuth();
  const isPharmacist = role === 'Pharmacist';

  return (
    <FeatureFlagsProvider userId={user?.id}>
      <Router>
               {false ? <PharmacyRoutes /> : <DoctorRoutes />}
      </Router>
    </FeatureFlagsProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;