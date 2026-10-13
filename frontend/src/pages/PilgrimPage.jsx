import React, { useState, useEffect } from 'react';
import { fetchLandmarks, reportIncident } from '../api';

export default function PilgrimPage() {
  const [incidentType, setIncidentType] = useState('medical');
  const [landmarks, setLandmarks] = useState([]);
  const [selectedLandmark, setSelectedLandmark] = useState('');
  const [phone, setPhone] = useState('');
  const [locationMode, setLocationMode] = useState('auto'); // 'gps' or 'landmark'
  const [gpsCoords, setGpsCoords] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('detecting'); // 'detecting', 'success', 'denied', 'unsupported'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [confirmedIncident, setConfirmedIncident] = useState(null);

  // Load landmark codes for manual fallback
  useEffect(() => {
    fetchLandmarks()
      .then((data) => {
        setLandmarks(data);
        if (data && data.length > 0) {
          setSelectedLandmark(data[0].code);
        }
      })
      .catch((err) => console.error('Error fetching landmarks:', err));
  }, []);

  // Request browser geolocation
  const detectGeolocation = () => {
    if (!('geolocation' in navigator)) {
      setGpsStatus('unsupported');
      setLocationMode('landmark');
      return;
    }

    setGpsStatus('detecting');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setGpsStatus('success');
        setLocationMode('gps');
      },
      (err) => {
        console.warn('Geolocation denied or failed:', err);
        setGpsStatus('denied');
        setLocationMode('landmark');
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 }
    );
  };

  useEffect(() => {
    detectGeolocation();
  }, []);

  const handleSOSSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const payload = {
      type: incidentType,
      source: 'web',
      phone: phone.trim() || undefined,
    };

    if (locationMode === 'gps' && gpsCoords) {
      payload.lat = gpsCoords.lat;
      payload.lng = gpsCoords.lng;
    } else {
      payload.landmark_code = selectedLandmark;
    }

    try {
      const incident = await reportIncident(payload);
      setConfirmedIncident(incident);
    } catch (err) {
      console.error('Failed to report SOS incident:', err);
      setError(err.message || 'Failed to submit SOS request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setConfirmedIncident(null);
    setError(null);
    detectGeolocation();
  };

  // -------------------------------------------------------------
  // CONFIRMATION SCREEN
  // -------------------------------------------------------------
  if (confirmedIncident) {
    const responderTypeLabel =
      confirmedIncident.responder_kind === 'medical'
        ? 'Medical Emergency Team'
        : confirmedIncident.responder_kind === 'police'
        ? 'Police Patrol Unit'
        : confirmedIncident.responder_kind === 'volunteer'
        ? 'Volunteer Safety Unit'
        : 'Emergency Responder';

    return (
      <div style={{ maxWidth: '480px', margin: '1rem auto', padding: '1.25rem', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{
          background: '#ecfdf5',
          border: '2px solid #10b981',
          borderRadius: '12px',
          padding: '1.5rem',
          textAlign: 'center',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🚨</div>
          <h1 style={{ margin: '0 0 0.5rem 0', color: '#065f46', fontSize: '1.6rem' }}>
            Help Is On The Way!
          </h1>
          <p style={{ margin: '0 0 1rem 0', color: '#047857', fontSize: '1rem', fontWeight: '500' }}>
            Your emergency alert was received and dispatched.
          </p>

          {/* Assigned Responder Card */}
          <div style={{
            background: '#ffffff',
            borderRadius: '8px',
            padding: '1rem',
            textAlign: 'left',
            border: '1px solid #d1fae5',
            marginBottom: '1rem',
          }}>
            <div style={{ fontSize: '0.8rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 'bold' }}>
              Assigned Responder
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#111827', marginTop: '0.2rem' }}>
              {confirmedIncident.responder_name || 'Emergency Team Dispatched'}
            </div>
            <div style={{ display: 'inline-block', marginTop: '0.35rem', background: '#dbeafe', color: '#1e40af', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
              {responderTypeLabel}
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #f3f4f6', margin: '0.75rem 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.3rem' }}>
              <span>Incident ID:</span>
              <strong>#{confirmedIncident.id}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.3rem' }}>
              <span>Emergency Type:</span>
              <strong style={{ textTransform: 'capitalize' }}>{confirmedIncident.type}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#4b5563' }}>
              <span>Status:</span>
              <span style={{ color: '#059669', fontWeight: 'bold', textTransform: 'uppercase' }}>
                {confirmedIncident.status}
              </span>
            </div>
          </div>

          <div style={{ background: '#fef3c7', padding: '0.75rem', borderRadius: '6px', fontSize: '0.85rem', color: '#92400e', marginBottom: '1.25rem' }}>
            💡 <strong>Safety Advice:</strong> Please stay in your current location if it is safe to do so. Look out for the responding team.
          </div>

          <button
            type="button"
            onClick={handleReset}
            style={{
              width: '100%',
              background: '#374151',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.85rem',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            Submit Another Request / Back
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // SOS TRIGGER & FORM SCREEN
  // -------------------------------------------------------------
  return (
    <div style={{ maxWidth: '480px', margin: '1rem auto', padding: '1rem', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
        <h1 style={{ margin: '0 0 0.25rem 0', fontSize: '1.75rem', color: '#111827' }}>
          Pilgrim Emergency SOS
        </h1>
        <p style={{ margin: 0, color: '#4b5563', fontSize: '0.9rem' }}>
          Simhastha Kumbh Mela • One-Tap Safety & Immediate Dispatch
        </p>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSOSSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Step 1: Emergency Type Selection */}
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.95rem', color: '#1f2937', marginBottom: '0.5rem' }}>
            1. Select Emergency Type:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setIncidentType('medical')}
              style={{
                border: incidentType === 'medical' ? '2px solid #dc2626' : '1px solid #d1d5db',
                background: incidentType === 'medical' ? '#fef2f2' : '#ffffff',
                borderRadius: '8px',
                padding: '0.85rem 0.4rem',
                textAlign: 'center',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <span style={{ fontSize: '1.8rem' }}>🚑</span>
              <span style={{ fontSize: '0.85rem', fontWeight: incidentType === 'medical' ? 'bold' : 'normal', color: incidentType === 'medical' ? '#dc2626' : '#374151' }}>
                Medical
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIncidentType('lost')}
              style={{
                border: incidentType === 'lost' ? '2px solid #2563eb' : '1px solid #d1d5db',
                background: incidentType === 'lost' ? '#eff6ff' : '#ffffff',
                borderRadius: '8px',
                padding: '0.85rem 0.4rem',
                textAlign: 'center',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <span style={{ fontSize: '1.8rem' }}>🔍</span>
              <span style={{ fontSize: '0.85rem', fontWeight: incidentType === 'lost' ? 'bold' : 'normal', color: incidentType === 'lost' ? '#2563eb' : '#374151' }}>
                Lost Person
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIncidentType('crowd')}
              style={{
                border: incidentType === 'crowd' ? '2px solid #d97706' : '1px solid #d1d5db',
                background: incidentType === 'crowd' ? '#fffbeb' : '#ffffff',
                borderRadius: '8px',
                padding: '0.85rem 0.4rem',
                textAlign: 'center',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <span style={{ fontSize: '1.8rem' }}>⚠️</span>
              <span style={{ fontSize: '0.85rem', fontWeight: incidentType === 'crowd' ? 'bold' : 'normal', color: incidentType === 'crowd' ? '#d97706' : '#374151' }}>
                Crowd Surge
              </span>
            </button>
          </div>
        </div>

        {/* Step 2: Location (GPS or Landmark) */}
        <div style={{ background: '#f9fafb', padding: '1rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.95rem', color: '#1f2937', marginBottom: '0.4rem' }}>
            2. Your Location:
          </label>

          {/* GPS Status Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem', fontSize: '0.825rem' }}>
            <span>
              {gpsStatus === 'detecting' && '📡 Detecting device GPS...'}
              {gpsStatus === 'success' && '📍 GPS Location Acquired'}
              {gpsStatus === 'denied' && '⚠️ GPS Permission Denied / Unavailable'}
              {gpsStatus === 'unsupported' && '⚠️ Geolocation not supported'}
            </span>

            {gpsStatus === 'success' && (
              <button
                type="button"
                onClick={() => setLocationMode(locationMode === 'gps' ? 'landmark' : 'gps')}
                style={{ background: 'none', border: 'none', color: '#2563eb', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.8rem' }}
              >
                {locationMode === 'gps' ? 'Use Landmark Instead' : 'Use GPS Instead'}
              </button>
            )}
          </div>

          {locationMode === 'gps' && gpsCoords ? (
            <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem', color: '#065f46' }}>
              ✓ Lat: {gpsCoords.lat.toFixed(4)}, Lng: {gpsCoords.lng.toFixed(4)} (Nashik Area)
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.3rem' }}>
                Select closest physical landmark or gate sign:
              </div>
              <select
                value={selectedLandmark}
                onChange={(e) => setSelectedLandmark(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '0.9rem',
                  background: '#ffffff',
                }}
              >
                {landmarks.map((lm) => (
                  <option key={lm.code} value={lm.code}>
                    [{lm.code}] {lm.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Step 3: Optional Contact Phone */}
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.9rem', color: '#374151', marginBottom: '0.3rem' }}>
            3. Contact Phone Number (Optional):
          </label>
          <input
            type="tel"
            placeholder="e.g. 9876543210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              fontSize: '0.95rem',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Big Red SOS Action Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            background: '#dc2626',
            color: '#ffffff',
            border: 'none',
            borderRadius: '12px',
            padding: '1.25rem',
            fontSize: '1.35rem',
            fontWeight: '900',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            boxShadow: '0 6px 14px rgba(220, 38, 38, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            marginTop: '0.5rem',
          }}
        >
          {isSubmitting ? 'Dispatching Help...' : '🚨 Send Emergency SOS 🚨'}
        </button>
      </form>
    </div>
  );
}
