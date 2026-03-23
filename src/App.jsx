import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Exam from './pages/Exam';
import Result from './pages/Result';
import Tutorial from './pages/Tutorial';
import AdminDashboard from './pages/AdminDashboard';
import AdminLogin from './pages/AdminLogin';
import LiveMonitoring from './pages/LiveMonitoring';
import { AuthProvider } from './context/AuthContext';
import { ExamProvider } from './context/ExamContext';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <ExamProvider>
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/exam" element={<Exam />} />
              <Route path="/tutorial" element={<Tutorial />} />
              <Route path="/result" element={<Result />} />
              <Route path="/admin-login" element={<AdminLogin />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/live" element={<LiveMonitoring />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </ExamProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
