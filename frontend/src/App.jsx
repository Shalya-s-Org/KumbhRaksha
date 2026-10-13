import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PilgrimPage from './pages/PilgrimPage';
import ControlPage from './pages/ControlPage';
import ChatSimPage from './pages/ChatSimPage';
import ScanPage from './pages/ScanPage';

export default function App() {
  return (
    <BrowserRouter>
      <header style={{
        background: '#1e293b',
        padding: '0.75rem 1.5rem',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
          <Link to="/" style={{ color: '#fff', textDecoration: 'none' }}>KumbhRaksha</Link>
        </div>
        <nav style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Link to="/pilgrim" style={{ color: '#93c5fd', textDecoration: 'none' }}>Pilgrim</Link>
          <Link to="/control" style={{ color: '#93c5fd', textDecoration: 'none' }}>Control</Link>
          <Link to="/chat-sim" style={{ color: '#93c5fd', textDecoration: 'none' }}>Chat Sim</Link>
          <Link to="/scan/demo-token-sunita" style={{ color: '#93c5fd', textDecoration: 'none' }}>Scan</Link>
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/pilgrim" element={<PilgrimPage />} />
          <Route path="/control" element={<ControlPage />} />
          <Route path="/chat-sim" element={<ChatSimPage />} />
          <Route path="/scan/:token" element={<ScanPage />} />
          <Route path="/scan" element={<ScanPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
