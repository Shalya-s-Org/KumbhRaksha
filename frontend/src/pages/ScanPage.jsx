import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { fetchMemberByToken } from '../api';

export default function ScanPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [manualToken, setManualToken] = useState('');
  const [scannerActive, setScannerActive] = useState(!token);
  const scannerRef = useRef(null);

  useEffect(() => {
    if (token) {
      setLoading(true);
      setError(null);
      fetchMemberByToken(token)
        .then((data) => {
          setMember(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error('Error fetching member:', err);
          setError(`Invalid or unregistered wristband token: '${token}'`);
          setLoading(false);
        });
    } else {
      setMember(null);
    }
  }, [token]);

  // Initialize html5-qrcode camera scanner
  useEffect(() => {
    if (!token && scannerActive) {
      const scanner = new Html5QrcodeScanner(
        'qr-reader',
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        false
      );

      scanner.render(
        (decodedText) => {
          // Check if decodedText is a full URL or token
          try {
            let extractedToken = decodedText;
            if (decodedText.includes('/scan/')) {
              const parts = decodedText.split('/scan/');
              extractedToken = parts[parts.length - 1];
            }
            scanner.clear().catch((e) => console.warn(e));
            navigate(`/scan/${extractedToken}`);
          } catch (e) {
            navigate(`/scan/${decodedText}`);
          }
        },
        (error) => {
          // scanner scanning frames - no error logging needed
        }
      );

      scannerRef.current = scanner;

      return () => {
        if (scannerRef.current) {
          scannerRef.current.clear().catch((e) => console.warn(e));
        }
      };
    }
  }, [token, scannerActive, navigate]);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualToken.trim()) {
      navigate(`/scan/${manualToken.trim()}`);
    }
  };

  return (
    <div style={{ maxWidth: '520px', margin: '1rem auto', padding: '1rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
        <h1 style={{ margin: '0 0 0.25rem 0', fontSize: '1.6rem', color: '#111827' }}>
          Volunteer Wristband Scanner
        </h1>
        <p style={{ margin: 0, color: '#4b5563', fontSize: '0.85rem' }}>
          Simhastha Kumbh Mela • Pilgrim Identification & Medical Summary
        </p>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* CASE 1: DISPLAY MEMBER DETAILS                               */}
      {/* ------------------------------------------------------------- */}
      {token && (
        <div>
          {loading && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#4b5563' }}>
              🔍 Looking up wristband in registry...
            </div>
          )}

          {error && (
            <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
              <strong>Identification Error:</strong>
              <div style={{ marginTop: '0.25rem', fontSize: '0.9rem' }}>{error}</div>
              <div style={{ marginTop: '0.75rem' }}>
                <Link to="/scan" style={{ color: '#2563eb', fontWeight: 'bold', textDecoration: 'underline' }}>
                  ← Scan Another Wristband
                </Link>
              </div>
            </div>
          )}

          {member && (
            <div style={{
              background: '#ffffff',
              border: '2px solid #3b82f6',
              borderRadius: '12px',
              padding: '1.25rem',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', background: '#dbeafe', color: '#1e40af', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 'bold' }}>
                    FAMILY: {member.family_code}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', fontFamily: 'monospace' }}>
                  {member.qr_token}
                </div>
              </div>

              {/* Pilgrim Identity */}
              <div style={{ marginBottom: '1rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#111827' }}>
                  {member.name}
                </h2>
                <div style={{ fontSize: '1rem', color: '#4b5563', marginTop: '0.2rem' }}>
                  Age: <strong>{member.age} years</strong> • Relation: <strong>{member.relation || 'Family Member'}</strong>
                </div>
              </div>

              {/* Critical Medical Note */}
              {member.medical_note ? (
                <div style={{
                  background: '#fef2f2',
                  border: '2px solid #ef4444',
                  borderRadius: '8px',
                  padding: '0.85rem',
                  marginBottom: '1rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#991b1b', fontWeight: 'bold', fontSize: '0.9rem' }}>
                    <span>⚠️ CRITICAL MEDICAL NOTE</span>
                  </div>
                  <div style={{ marginTop: '0.35rem', color: '#7f1d1d', fontSize: '0.95rem', fontWeight: '500' }}>
                    {member.medical_note}
                  </div>
                </div>
              ) : (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem', color: '#166534', marginBottom: '1rem' }}>
                  ✓ No special medical conditions recorded.
                </div>
              )}

              {/* Emergency Contact */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>
                  Emergency Family Contact
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#0f172a', marginTop: '0.2rem' }}>
                  {member.head_name} (Family Head)
                </div>
                <div style={{ fontSize: '1.2rem', color: '#2563eb', fontWeight: 'bold', marginTop: '0.35rem' }}>
                  📞 {member.head_phone}
                </div>
              </div>

              {/* Quick Actions for Volunteer */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <a
                  href={`tel:${member.head_phone}`}
                  style={{
                    background: '#16a34a',
                    color: '#ffffff',
                    textAlign: 'center',
                    padding: '0.85rem',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    textDecoration: 'none',
                    fontSize: '1rem',
                    boxShadow: '0 2px 4px rgba(22,163,74,0.3)',
                    display: 'block',
                  }}
                >
                  📞 Call Family Head Immediately
                </a>

                <Link
                  to="/scan"
                  style={{
                    background: '#f1f5f9',
                    color: '#334155',
                    textAlign: 'center',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    textDecoration: 'none',
                    fontSize: '0.9rem',
                    display: 'block',
                  }}
                >
                  📷 Scan Another Wristband
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* CASE 2: SCANNER & MANUAL TOKEN INPUT                          */}
      {/* ------------------------------------------------------------- */}
      {!token && (
        <div>
          {/* Live Camera Scanner Container */}
          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '1rem' }}>
            <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: '#111827' }}>
              Camera QR Scanner
            </h2>
            <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.825rem', color: '#4b5563' }}>
              Point device camera at the pilgrim wristband QR code.
            </p>

            <div id="qr-reader" style={{ width: '100%', borderRadius: '8px', overflow: 'hidden' }}></div>
          </div>

          {/* Manual Token Entry Fallback */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
            <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '0.95rem', color: '#1e293b' }}>
              Manual Token Lookup / Testing
            </h3>
            <p style={{ margin: '0 0 0.6rem 0', fontSize: '0.8rem', color: '#64748b' }}>
              Enter token manually if camera is unavailable:
            </p>

            <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="e.g. demo-token-sunita"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
              />
              <button
                type="submit"
                style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.5rem 0.85rem', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer' }}
              >
                Lookup
              </button>
            </form>

            {/* Quick Demo Token Links */}
            <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#64748b' }}>
              <span>Demo Quick-Lookups: </span>
              <Link to="/scan/demo-token-sunita" style={{ color: '#2563eb', marginRight: '0.5rem' }}>
                Sunita (Diabetic, 68)
              </Link>
              <Link to="/scan/demo-token-aarav" style={{ color: '#2563eb' }}>
                Aarav (Child, 6)
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
