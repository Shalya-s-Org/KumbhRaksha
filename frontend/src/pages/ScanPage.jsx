import React from 'react';
import { useParams } from 'react-router-dom';

export default function ScanPage() {
  const { token } = useParams();

  return (
    <div style={{ padding: '1.5rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Volunteer Wristband QR Scanner</h1>
      <p>Placeholder: Volunteer Scan interface (/scan/:token).</p>
      <div style={{ background: '#f3f4f6', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
        <strong>Scanned Token:</strong> <code>{token || 'None provided'}</code>
      </div>
      <ul style={{ marginTop: '1rem' }}>
        <li>Member identity and age</li>
        <li>Family head emergency contact</li>
        <li>Critical medical notes</li>
      </ul>
    </div>
  );
}
