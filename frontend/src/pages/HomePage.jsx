import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { checkHealth } from '../api';

export default function HomePage() {
  const [healthStatus, setHealthStatus] = useState('checking...');

  useEffect(() => {
    checkHealth()
      .then((data) => setHealthStatus(`Online (${data.status})`))
      .catch((err) => setHealthStatus(`Offline or unreachable (${err.message})`));
  }, []);

  return (
    <div style={{ maxWidth: '700px', margin: '2rem auto', padding: '1.5rem', fontFamily: 'sans-serif' }}>
      <h1>KumbhRaksha Platform Skeleton</h1>
      <p>Simhastha Kumbh Mela - Safety & Crowd Management Platform</p>
      
      <div style={{ padding: '0.75rem 1rem', background: '#e0f2fe', borderRadius: '6px', marginBottom: '1.5rem' }}>
        <strong>Backend Health:</strong> {healthStatus}
      </div>

      <h2>Available Interfaces</h2>
      <ul style={{ lineHeight: '2' }}>
        <li>
          <Link to="/pilgrim"><strong>/pilgrim</strong></Link> - Pilgrim Interface (Mobile PWA)
        </li>
        <li>
          <Link to="/control"><strong>/control</strong></Link> - Command & Control Dashboard
        </li>
        <li>
          <Link to="/chat-sim"><strong>/chat-sim</strong></Link> - SMS / WhatsApp Low-Bandwidth Chat Simulator
        </li>
        <li>
          <Link to="/scan/demo-token-sunita"><strong>/scan/:token</strong></Link> - Volunteer QR Scanner Details (e.g. <code>/scan/demo-token-sunita</code>)
        </li>
      </ul>
    </div>
  );
}
