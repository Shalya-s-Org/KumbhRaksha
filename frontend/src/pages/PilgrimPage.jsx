import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { fetchLandmarks, reportIncident, createFamily, fetchFamily } from '../api';

export default function PilgrimPage() {
  const [activeTab, setActiveTab] = useState('sos'); // 'sos' or 'family'

  // --- SOS State ---
  const [incidentType, setIncidentType] = useState('medical');
  const [landmarks, setLandmarks] = useState([]);
  const [selectedLandmark, setSelectedLandmark] = useState('');
  const [sosPhone, setSosPhone] = useState('');
  const [locationMode, setLocationMode] = useState('auto');
  const [gpsCoords, setGpsCoords] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('detecting');
  const [isSosSubmitting, setIsSosSubmitting] = useState(false);
  const [sosError, setSosError] = useState(null);
  const [confirmedIncident, setConfirmedIncident] = useState(null);

  // --- Family State ---
  const [headName, setHeadName] = useState('');
  const [familyPhone, setFamilyPhone] = useState('');
  const [members, setMembers] = useState([
    { name: '', age: '', relation: 'Mother', medical_note: '' },
    { name: '', age: '', relation: 'Son', medical_note: '' },
  ]);
  const [createdFamily, setCreatedFamily] = useState(null);
  const [lookupCode, setLookupCode] = useState('');
  const [familyError, setFamilyError] = useState(null);
  const [isFamilySubmitting, setIsFamilySubmitting] = useState(false);

  // Load landmarks
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

  // Request GPS
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

  // Handle SOS
  const handleSOSSubmit = async (e) => {
    e.preventDefault();
    setIsSosSubmitting(true);
    setSosError(null);

    const payload = {
      type: incidentType,
      source: 'web',
      phone: sosPhone.trim() || undefined,
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
      setSosError(err.message || 'Failed to submit SOS request. Please try again.');
    } finally {
      setIsSosSubmitting(false);
    }
  };

  // Handle Family creation
  const handleAddMember = () => {
    setMembers([...members, { name: '', age: '', relation: '', medical_note: '' }]);
  };

  const handleRemoveMember = (idx) => {
    setMembers(members.filter((_, i) => i !== idx));
  };

  const handleMemberChange = (idx, field, val) => {
    const updated = [...members];
    updated[idx][field] = val;
    setMembers(updated);
  };

  const handleCreateFamilySubmit = async (e) => {
    e.preventDefault();
    if (!headName.trim() || !familyPhone.trim()) {
      setFamilyError('Please enter family head name and emergency phone.');
      return;
    }

    const validMembers = members
      .filter((m) => m.name.trim() && m.age)
      .map((m) => ({
        name: m.name.trim(),
        age: parseInt(m.age, 10),
        relation: m.relation.trim(),
        medical_note: m.medical_note.trim(),
      }));

    if (validMembers.length === 0) {
      setFamilyError('Please add at least one member with name and age.');
      return;
    }

    setIsFamilySubmitting(true);
    setFamilyError(null);
    try {
      const res = await createFamily({
        head_name: headName.trim(),
        phone: familyPhone.trim(),
        members: validMembers,
      });
      setCreatedFamily(res);
    } catch (err) {
      console.error('Failed to create family:', err);
      setFamilyError(err.message || 'Error creating family safety group.');
    } finally {
      setIsFamilySubmitting(false);
    }
  };

  const handleLookupFamily = async (e) => {
    e.preventDefault();
    if (!lookupCode.trim()) return;
    setIsFamilySubmitting(true);
    setFamilyError(null);
    try {
      const res = await fetchFamily(lookupCode.trim());
      setCreatedFamily(res);
    } catch (err) {
      setFamilyError(`Family code '${lookupCode}' not found.`);
    } finally {
      setIsFamilySubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ maxWidth: '600px', margin: '1rem auto', padding: '1rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Tab Switcher */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('sos')}
          style={{
            padding: '0.75rem',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'sos' ? '#dc2626' : '#f3f4f6',
            color: activeTab === 'sos' ? '#ffffff' : '#374151',
            fontWeight: 'bold',
            fontSize: '1rem',
            cursor: 'pointer',
            boxShadow: activeTab === 'sos' ? '0 2px 4px rgba(220,38,38,0.2)' : 'none',
          }}
        >
          🚨 Emergency SOS
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('family')}
          style={{
            padding: '0.75rem',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'family' ? '#2563eb' : '#f3f4f6',
            color: activeTab === 'family' ? '#ffffff' : '#374151',
            fontWeight: 'bold',
            fontSize: '1rem',
            cursor: 'pointer',
            boxShadow: activeTab === 'family' ? '0 2px 4px rgba(37,99,235,0.2)' : 'none',
          }}
        >
          👨‍👩‍👧‍👦 Family QR Group
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: EMERGENCY SOS                                          */}
      {/* ============================================================== */}
      {activeTab === 'sos' && (
        <>
          {confirmedIncident ? (
            <div style={{
              background: '#ecfdf5',
              border: '2px solid #10b981',
              borderRadius: '12px',
              padding: '1.5rem',
              textAlign: 'center',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🚨</div>
              <h1 style={{ margin: '0 0 0.5rem 0', color: '#065f46', fontSize: '1.5rem' }}>
                Help Is On The Way!
              </h1>
              <p style={{ margin: '0 0 1rem 0', color: '#047857', fontSize: '0.95rem', fontWeight: '500' }}>
                Your emergency alert was received and dispatched.
              </p>

              <div style={{
                background: '#ffffff',
                borderRadius: '8px',
                padding: '1rem',
                textAlign: 'left',
                border: '1px solid #d1fae5',
                marginBottom: '1rem',
              }}>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 'bold' }}>
                  Assigned Emergency Team
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#111827', marginTop: '0.2rem' }}>
                  {confirmedIncident.responder_name || 'Emergency Team Dispatched'}
                </div>
                <div style={{ display: 'inline-block', marginTop: '0.35rem', background: '#dbeafe', color: '#1e40af', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                  {confirmedIncident.responder_kind ? `${confirmedIncident.responder_kind.toUpperCase()} UNIT` : 'RESPONDER'}
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid #f3f4f6', margin: '0.75rem 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.3rem' }}>
                  <span>Ticket Ref:</span>
                  <strong>#{confirmedIncident.id}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.3rem' }}>
                  <span>Type:</span>
                  <strong style={{ textTransform: 'capitalize' }}>{confirmedIncident.type}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#4b5563' }}>
                  <span>Status:</span>
                  <span style={{ color: '#059669', fontWeight: 'bold', textTransform: 'uppercase' }}>
                    {confirmedIncident.status}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setConfirmedIncident(null)}
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
          ) : (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <h1 style={{ margin: '0 0 0.25rem 0', fontSize: '1.6rem', color: '#111827' }}>
                  Pilgrim Emergency SOS
                </h1>
                <p style={{ margin: 0, color: '#4b5563', fontSize: '0.85rem' }}>
                  One-tap alert with automatic location and responder dispatch
                </p>
              </div>

              {sosError && (
                <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                  {sosError}
                </div>
              )}

              <form onSubmit={handleSOSSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.9rem', color: '#1f2937', marginBottom: '0.4rem' }}>
                    1. Emergency Type:
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setIncidentType('medical')}
                      style={{
                        border: incidentType === 'medical' ? '2px solid #dc2626' : '1px solid #d1d5db',
                        background: incidentType === 'medical' ? '#fef2f2' : '#ffffff',
                        borderRadius: '8px',
                        padding: '0.85rem 0.25rem',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.2rem',
                      }}
                    >
                      <span style={{ fontSize: '1.75rem' }}>🚑</span>
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
                        padding: '0.85rem 0.25rem',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.2rem',
                      }}
                    >
                      <span style={{ fontSize: '1.75rem' }}>🔍</span>
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
                        padding: '0.85rem 0.25rem',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.2rem',
                      }}
                    >
                      <span style={{ fontSize: '1.75rem' }}>⚠️</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: incidentType === 'crowd' ? 'bold' : 'normal', color: incidentType === 'crowd' ? '#d97706' : '#374151' }}>
                        Crowd Surge
                      </span>
                    </button>
                  </div>
                </div>

                <div style={{ background: '#f9fafb', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.9rem', color: '#1f2937', marginBottom: '0.4rem' }}>
                    2. Location:
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8rem' }}>
                    <span>
                      {gpsStatus === 'detecting' && '📡 Detecting GPS...'}
                      {gpsStatus === 'success' && '📍 GPS Location Acquired'}
                      {gpsStatus === 'denied' && '⚠️ Using Physical Landmark Signs'}
                      {gpsStatus === 'unsupported' && '⚠️ Using Physical Landmark Signs'}
                    </span>
                    {gpsStatus === 'success' && (
                      <button
                        type="button"
                        onClick={() => setLocationMode(locationMode === 'gps' ? 'landmark' : 'gps')}
                        style={{ background: 'none', border: 'none', color: '#2563eb', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.8rem' }}
                      >
                        {locationMode === 'gps' ? 'Use Landmark' : 'Use GPS'}
                      </button>
                    )}
                  </div>

                  {locationMode === 'gps' && gpsCoords ? (
                    <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '0.45rem 0.6rem', borderRadius: '6px', fontSize: '0.825rem', color: '#065f46' }}>
                      ✓ GPS: {gpsCoords.lat.toFixed(4)}, {gpsCoords.lng.toFixed(4)}
                    </div>
                  ) : (
                    <select
                      value={selectedLandmark}
                      onChange={(e) => setSelectedLandmark(e.target.value)}
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem', background: '#fff' }}
                    >
                      {landmarks.map((lm) => (
                        <option key={lm.code} value={lm.code}>
                          [{lm.code}] {lm.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', color: '#374151', marginBottom: '0.3rem' }}>
                    3. Contact Phone (Optional):
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={sosPhone}
                    onChange={(e) => setSosPhone(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSosSubmitting}
                  style={{
                    background: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '1.15rem',
                    fontSize: '1.25rem',
                    fontWeight: '900',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    cursor: isSosSubmitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 10px rgba(220, 38, 38, 0.35)',
                    marginTop: '0.25rem',
                  }}
                >
                  {isSosSubmitting ? 'Dispatching Help...' : '🚨 Send Emergency SOS 🚨'}
                </button>
              </form>
            </div>
          )}
        </>
      )}

      {/* ============================================================== */}
      {/* TAB 2: FAMILY SAFETY GROUP & QR CODES                          */}
      {/* ============================================================== */}
      {activeTab === 'family' && (
        <div>
          {createdFamily ? (
            <div>
              {/* Family Header */}
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#1e40af' }}>
                      Family Group: {createdFamily.code}
                    </h2>
                    <div style={{ fontSize: '0.875rem', color: '#3b82f6', marginTop: '0.2rem' }}>
                      Head: <strong>{createdFamily.head_name}</strong> • Emergency: <strong>{createdFamily.phone}</strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={handlePrint}
                      style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.5rem 0.85rem', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      🖨️ Print / Save Cards
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreatedFamily(null)}
                      style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.85rem', cursor: 'pointer' }}
                    >
                      New Family
                    </button>
                  </div>
                </div>
              </div>

              {/* Printable Wristband Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {createdFamily.members.map((member) => {
                  const scanUrl = `${window.location.origin}/scan/${member.qr_token}`;
                  return (
                    <div
                      key={member.id}
                      style={{
                        background: '#ffffff',
                        border: '2px solid #e5e7eb',
                        borderRadius: '10px',
                        padding: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                        pageBreakInside: 'avoid',
                      }}
                    >
                      <div style={{ flex: '1' }}>
                        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 'bold' }}>
                          Simhastha Kumbh Mela Wristband
                        </div>
                        <h3 style={{ margin: '0.2rem 0', fontSize: '1.25rem', color: '#111827' }}>
                          {member.name} ({member.age} yrs)
                        </h3>
                        <div style={{ fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.35rem' }}>
                          Relation: <strong>{member.relation || 'Member'}</strong>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#1e40af', background: '#dbeafe', padding: '0.25rem 0.5rem', borderRadius: '4px', display: 'inline-block' }}>
                          Emergency Contact: <strong>{createdFamily.phone}</strong>
                        </div>

                        {member.medical_note && (
                          <div style={{ marginTop: '0.45rem', fontSize: '0.8rem', color: '#991b1b', background: '#fee2e2', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                            ⚠️ Medical: {member.medical_note}
                          </div>
                        )}

                        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
                          <a
                            href={scanUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: '#2563eb', textDecoration: 'underline' }}
                          >
                            Simulate Scan Details ➔
                          </a>
                        </div>
                      </div>

                      {/* Scannable QR Code */}
                      <div style={{ textAlign: 'center', background: '#fafafa', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                        <QRCodeSVG value={scanUrl} size={110} level="M" />
                        <div style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: '0.25rem', fontFamily: 'monospace' }}>
                          {member.qr_token}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                <h1 style={{ margin: '0 0 0.25rem 0', fontSize: '1.5rem', color: '#111827' }}>
                  Create Family Safety Group
                </h1>
                <p style={{ margin: 0, color: '#4b5563', fontSize: '0.85rem' }}>
                  Generate physical or digital QR wristbands for elders and children
                </p>
              </div>

              {/* Lookup Existing Family */}
              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
                <form onSubmit={handleLookupFamily} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Already have code? (e.g. DEMO001)"
                    value={lookupCode}
                    onChange={(e) => setLookupCode(e.target.value)}
                    style={{ flex: 1, padding: '0.45rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                  <button
                    type="submit"
                    disabled={isFamilySubmitting}
                    style={{ background: '#475569', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.45rem 0.85rem', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    View Group
                  </button>
                </form>
              </div>

              {familyError && (
                <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.65rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                  {familyError}
                </div>
              )}

              <form onSubmit={handleCreateFamilySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', color: '#374151', marginBottom: '0.25rem' }}>
                      Family Head Name:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Sharma"
                      value={headName}
                      onChange={(e) => setHeadName(e.target.value)}
                      required
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', color: '#374151', marginBottom: '0.25rem' }}>
                      Emergency Phone:
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 9876543210"
                      value={familyPhone}
                      onChange={(e) => setFamilyPhone(e.target.value)}
                      required
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#1f2937' }}>
                      Family Members:
                    </label>
                    <button
                      type="button"
                      onClick={handleAddMember}
                      style={{ background: '#e0e7ff', color: '#3730a3', border: 'none', borderRadius: '4px', padding: '0.25rem 0.5rem', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      + Add Member
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {members.map((m, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: '#f9fafb',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          padding: '0.75rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.45rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#4b5563' }}>
                            Member #{idx + 1}
                          </span>
                          {members.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(idx)}
                              style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.75rem', cursor: 'pointer' }}
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.5rem' }}>
                          <input
                            type="text"
                            placeholder="Full Name"
                            value={m.name}
                            onChange={(e) => handleMemberChange(idx, 'name', e.target.value)}
                            required
                            style={{ padding: '0.45rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                          />
                          <input
                            type="number"
                            placeholder="Age"
                            value={m.age}
                            onChange={(e) => handleMemberChange(idx, 'age', e.target.value)}
                            required
                            style={{ padding: '0.45rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                          />
                          <input
                            type="text"
                            placeholder="Relation"
                            value={m.relation}
                            onChange={(e) => handleMemberChange(idx, 'relation', e.target.value)}
                            style={{ padding: '0.45rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                          />
                        </div>

                        <input
                          type="text"
                          placeholder="Medical Note (e.g. Diabetic, takes insulin, blood group)"
                          value={m.medical_note}
                          onChange={(e) => handleMemberChange(idx, 'medical_note', e.target.value)}
                          style={{ padding: '0.45rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.8rem' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isFamilySubmitting}
                  style={{
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '0.9rem',
                    fontSize: '1.05rem',
                    fontWeight: 'bold',
                    cursor: isFamilySubmitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 6px rgba(37,99,235,0.2)',
                    marginTop: '0.5rem',
                  }}
                >
                  {isFamilySubmitting ? 'Generating Wristbands...' : 'Generate Family QR Codes'}
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
