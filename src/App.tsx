import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { FeatureFlagsProvider } from './contexts/FeatureFlagsContext';
import { useAuth } from './contexts/AuthContext';
import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import MainPage from './pages/MainPage';
import PatientProfile from './pages/PatientProfile';
import PreConsultForm from './pages/PreConsultForm';
import ClinicalSummariserList from './pages/ClinicalSummariserList';
import NewSummary from './pages/NewSummary';
import SummaryDetail from './pages/SummaryDetail';
import FavouritesPage from './pages/FavouritesPage';
import ResetPassword from './pages/ResetPassword';
import ProtectedRoute from './components/ProtectedRoute';

// Pharmacy pages
import PharmacyDashboard from './pages/pharmacy/PharmacyDashboard';
import DispenseScreen from './pages/pharmacy/DispenseScreen';
import InventoryPage from './pages/pharmacy/InventoryPage';
import BillsPage from './pages/pharmacy/BillsPage';
import PharmacyNav from './components/pharmacy/PharmacyNav';

function AppRoutes() {
    const { user, loading, passwordRecovery } = useAuth();
  const [role, setRole] = useState<string>('Doctor');
  const [roleLoading, setRoleLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setRole('Doctor');
      return;
    }
    setRoleLoading(true);
    supabase
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .single()
      .then(({ data }) => {
        setRole(data?.role || 'Doctor');
      })
      .catch(() => {
        setRole('Doctor');
      })
      .finally(() => {
        setRoleLoading(false);
      });
  }, [user?.id]);

  const isPharmacist = role === 'Pharmacist';

  return (
    <FeatureFlagsProvider userId={user?.id}>
      <Router>
        {isPharmacist ? (
          <>
            <PharmacyNav />
                        <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/" element={passwordRecovery ? <Navigate to="/reset-password" replace /> : <ProtectedRoute><PharmacyDashboard /></ProtectedRoute>} />
              <Route path="/dispense/:consultId" element={<ProtectedRoute><DispenseScreen /></ProtectedRoute>} />
              <Route path="/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
              <Route path="/bills" element={<ProtectedRoute><BillsPage /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes> 
          </>
        ) : (
                    <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={passwordRecovery ? <Navigate to="/reset-password" replace /> : <ProtectedRoute><MainPage /></ProtectedRoute>} />
            <Route path="/patient/:patientId" element={<ProtectedRoute><PatientProfile /></ProtectedRoute>} />
            <Route path="/pre-consult/:preConsultId" element={<PreConsultForm />} />
            <Route path="/clinical-summariser" element={<ProtectedRoute><ClinicalSummariserList /></ProtectedRoute>} />
            <Route path="/clinical-summariser/new" element={<ProtectedRoute><NewSummary /></ProtectedRoute>} />
            <Route path="/clinical-summariser/:id" element={<ProtectedRoute><SummaryDetail /></ProtectedRoute>} />
            <Route path="/favorites" element={<ProtectedRoute><FavouritesPage /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </Router>
    </FeatureFlagsProvider>
  );
}

function App() {
  // 1. Snapshot the exact URL the millisecond the app loads (before Supabase hides it)
  const [initialHash] = useState(window.location.hash);
  
  // Use our snapshot to determine if we need to pause
  const [isParsingAuth, setIsParsingAuth] = useState(
    initialHash.includes('access_token=')
  );

  useEffect(() => {
    if (isParsingAuth) {
      setTimeout(() => {
        setIsParsingAuth(false);
        
        // 2. Check our SAVED snapshot, not the live URL!
        if (initialHash.includes('type=recovery')) {
          window.location.hash = '/reset-password';
        } else {
          window.location.hash = '/';
        }
      }, 500);
    }
  }, [isParsingAuth, initialHash]);

  if (isParsingAuth) {
    return <div className="h-screen w-screen flex items-center justify-center bg-gray-50 text-gray-500">Verifying secure link...</div>;
  }

  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;