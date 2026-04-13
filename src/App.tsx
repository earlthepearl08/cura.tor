import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from '@/pages/Home';
import Scan from '@/pages/Scan';
import Upload from '@/pages/Upload';
import Contacts from '@/pages/Contacts';
import ManualInput from '@/pages/ManualInput';
import Settings from '@/pages/Settings';
import QRScan from '@/pages/QRScan';
import LogScan from '@/pages/LogScan';
import MultiCardScan from '@/pages/MultiCardScan';
import BatchHistory from '@/pages/BatchHistory';
import Legal from '@/pages/Legal';
import Auth from '@/pages/Auth';
import TeamAdmin from '@/pages/TeamAdmin';
import AcceptInvite from '@/pages/AcceptInvite';
import ProtectedRoute from '@/components/ProtectedRoute';
import { AuthProvider } from '@/contexts/AuthContext';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { getTheme } from '@/hooks/useTheme';

function App() {
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', getTheme());
    }, []);

    return (
        <Router>
            <AuthProvider>
                <WorkspaceProvider>
                    <div className="min-height-screen bg-brand-950">
                        <Routes>
                            <Route path="/auth" element={<Auth />} />
                            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                            <Route path="/scan" element={<ProtectedRoute><Scan /></ProtectedRoute>} />
                            <Route path="/upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
                            <Route path="/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
                            <Route path="/manual" element={<ProtectedRoute><ManualInput /></ProtectedRoute>} />
                            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                            <Route path="/qr-scan" element={<ProtectedRoute><QRScan /></ProtectedRoute>} />
                            <Route path="/log-scan" element={<ProtectedRoute><LogScan /></ProtectedRoute>} />
                            <Route path="/multi-card" element={<ProtectedRoute><MultiCardScan /></ProtectedRoute>} />
                            <Route path="/batch-history" element={<ProtectedRoute><BatchHistory /></ProtectedRoute>} />
                            <Route path="/team" element={<ProtectedRoute><TeamAdmin /></ProtectedRoute>} />
                            <Route path="/invite/:code" element={<ProtectedRoute><AcceptInvite /></ProtectedRoute>} />
                            <Route path="/legal" element={<Legal />} />
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </div>
                </WorkspaceProvider>
            </AuthProvider>
        </Router>
    );
}

export default App;
