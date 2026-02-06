import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from '@/pages/Home';
import Scan from '@/pages/Scan';
import Upload from '@/pages/Upload';
import Contacts from '@/pages/Contacts';
import ManualInput from '@/pages/ManualInput';
import Settings from '@/pages/Settings';

function App() {
    return (
        <Router>
            <div className="min-height-screen bg-brand-950">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/scan" element={<Scan />} />
                    <Route path="/upload" element={<Upload />} />
                    <Route path="/contacts" element={<Contacts />} />
                    <Route path="/manual" element={<ManualInput />} />
                    <Route path="/settings" element={<Settings />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;
