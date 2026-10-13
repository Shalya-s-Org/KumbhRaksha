import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchCrowdCurrent, fetchAlerts, triggerScenario, fetchIncidents } from '../api';

function getZoneColor(level) {
  switch (level) {
    case 'danger':
      return { color: '#dc2626', fillColor: '#ef4444' };
    case 'caution':
      return { color: '#d97706', fillColor: '#f59e0b' };
    case 'safe':
    default:
      return { color: '#059669', fillColor: '#10b981' };
  }
}

function createIncidentIcon(type) {
  const iconEmoji = type === 'medical' ? '🚑' : type === 'lost' ? '🔍' : '⚠️';
  const bgColor = type === 'medical' ? '#dc2626' : type === 'lost' ? '#2563eb' : '#d97706';
  return L.divIcon({
    className: 'incident-marker-icon',
    html: `<div style="
      background: ${bgColor};
      color: white;
      border-radius: 50%;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      border: 2px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      cursor: pointer;
    ">${iconEmoji}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

export default function ControlPage() {
  const [zones, setZones] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [selectedZoneId, setSelectedZoneId] = useState('1');
  const [scenarioStatus, setScenarioStatus] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const [crowdData, alertData, incidentData] = await Promise.all([
        fetchCrowdCurrent(),
        fetchAlerts(true),
        fetchIncidents(),
      ]);
      setZones(crowdData);
      setAlerts(alertData);
      setIncidents(incidentData);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error('Error fetching control room data:', err);
      setError(err.message);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleTriggerSurge = async () => {
    setIsSubmitting(true);
    try {
      const zoneIdNum = parseInt(selectedZoneId, 10);
      await triggerScenario('surge', zoneIdNum);
      const targetZone = zones.find((z) => z.zone_id === zoneIdNum);
      setScenarioStatus(`Surge scenario activated for ${targetZone ? targetZone.name : `Zone ${zoneIdNum}`}`);
      await loadData();
    } catch (err) {
      setError(`Failed to trigger surge: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async () => {
    setIsSubmitting(true);
    try {
      await triggerScenario('reset');
      setScenarioStatus('Simulator reset to baseline normal drift.');
      await loadData();
    } catch (err) {
      setError(`Failed to reset simulator: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Map center around Ramkund Ghat, Nashik
  const center = [20.007, 73.793];

  return (
    <div style={{ padding: '1rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top Header & Status Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <div>
          <h1 style={{ margin: '0 0 0.25rem 0', fontSize: '1.5rem', color: '#111827' }}>
            Command Dashboard & Live Crowd Map
          </h1>
          <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
            Live simulation & incidents polling (3s) • Last tick: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'connecting...'}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: '#f3f4f6', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.85rem' }}>
          <span style={{ fontWeight: 'bold' }}>Density (people/m²):</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
            Safe (&lt; 2)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }}></span>
            Caution (2 - 4)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }}></span>
            Danger (&gt; 4)
          </span>
          <span style={{ borderLeft: '1px solid #d1d5db', paddingLeft: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <span>📍</span> Incidents
          </span>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.75rem', borderRadius: '6px', marginBottom: '0.75rem' }}>
          <strong>Communication Error:</strong> {error}
        </div>
      )}

      {/* Main Grid: Map on Left, Control Panel & Alerts on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(340px, 1fr)', gap: '1rem' }}>
        {/* Left Column: Leaflet Map */}
        <div style={{ height: '74vh', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <MapContainer
            center={center}
            zoom={15}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Zone Density Circles */}
            {zones.map((zone) => {
              const colors = getZoneColor(zone.level);
              const radius = Math.max(65, Math.min(130, Math.sqrt(zone.area_m2 / Math.PI)));

              return (
                <Circle
                  key={`zone-${zone.zone_id}`}
                  center={[zone.lat, zone.lng]}
                  radius={radius}
                  pathOptions={{
                    color: colors.color,
                    fillColor: colors.fillColor,
                    fillOpacity: 0.5,
                    weight: 2,
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: '170px', fontFamily: 'sans-serif' }}>
                      <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1rem', color: '#111827' }}>{zone.name}</h3>
                      <div style={{ margin: '0.2rem 0', fontSize: '0.85rem' }}>
                        <strong>Current Count:</strong> {zone.count.toLocaleString()}
                      </div>
                      <div style={{ margin: '0.2rem 0', fontSize: '0.85rem' }}>
                        <strong>Current Density:</strong> {zone.density} / m²
                      </div>
                      <div style={{ margin: '0.2rem 0', fontSize: '0.85rem' }}>
                        <strong>Status:</strong>{' '}
                        <span style={{ textTransform: 'uppercase', fontWeight: 'bold', color: colors.color }}>
                          {zone.level}
                        </span>
                      </div>
                      <div style={{ marginTop: '0.5rem', paddingTop: '0.4rem', borderTop: '1px solid #e5e7eb', fontSize: '0.825rem' }}>
                        <strong>20-min Forecast:</strong>{' '}
                        <span style={{ fontWeight: '600', color: zone.forecast_density >= 4.0 ? '#dc2626' : '#2563eb' }}>
                          {zone.forecast_density !== null ? `${zone.forecast_density} / m² (${zone.forecast_level})` : 'Calculating...'}
                        </span>
                      </div>
                    </div>
                  </Popup>
                </Circle>
              );
            })}

            {/* Incident Markers */}
            {incidents.filter((inc) => inc.lat && inc.lng && inc.status !== 'resolved').map((incident) => (
              <Marker
                key={`incident-${incident.id}`}
                position={[incident.lat, incident.lng]}
                icon={createIncidentIcon(incident.type)}
              >
                <Popup>
                  <div style={{ minWidth: '180px', fontFamily: 'sans-serif' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                      <strong style={{ color: '#dc2626', fontSize: '0.95rem' }}>
                        🚨 Incident #{incident.id}
                      </strong>
                      <span style={{ background: '#fee2e2', color: '#991b1b', padding: '0.1rem 0.35rem', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
                        {incident.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', marginBottom: '0.2rem' }}>
                      <strong>Type:</strong> <span style={{ textTransform: 'capitalize' }}>{incident.type}</span>
                    </div>
                    {incident.phone && (
                      <div style={{ fontSize: '0.85rem', marginBottom: '0.2rem' }}>
                        <strong>Phone:</strong> {incident.phone}
                      </div>
                    )}
                    <div style={{ fontSize: '0.85rem', marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid #f3f4f6' }}>
                      <strong>Assigned Responder:</strong><br />
                      <span style={{ color: '#1e40af', fontWeight: 'bold' }}>
                        {incident.responder_name || 'Dispatching nearest...'}
                      </span>{' '}
                      {incident.responder_kind && `(${incident.responder_kind})`}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.3rem' }}>
                      Reported: {new Date(incident.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Right Column: Demo Controls, Incoming Incidents & Surge Warning Alerts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '74vh', overflowY: 'auto' }}>
          {/* Demo Scenario Controller Card */}
          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.85rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <h2 style={{ margin: '0 0 0.35rem 0', fontSize: '1rem', color: '#1f2937' }}>
              Demo Scenario Controller
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <select
                value={selectedZoneId}
                onChange={(e) => setSelectedZoneId(e.target.value)}
                style={{ width: '100%', padding: '0.35rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.825rem' }}
              >
                {zones.map((z) => (
                  <option key={z.zone_id} value={z.zone_id}>
                    Zone {z.zone_id}: {z.name} (Density: {z.density}/m²)
                  </option>
                ))}
              </select>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleTriggerSurge}
                  disabled={isSubmitting}
                  style={{
                    flex: '1',
                    background: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.45rem 0.6rem',
                    fontWeight: 'bold',
                    fontSize: '0.825rem',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  Trigger Surge (Demo)
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isSubmitting}
                  style={{
                    background: '#f3f4f6',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    padding: '0.45rem 0.6rem',
                    fontSize: '0.825rem',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  Reset
                </button>
              </div>

              {scenarioStatus && (
                <div style={{ fontSize: '0.775rem', background: '#ecfdf5', color: '#065f46', padding: '0.35rem 0.5rem', borderRadius: '4px' }}>
                  {scenarioStatus}
                </div>
              )}
            </div>
          </div>

          {/* Active Incidents Panel */}
          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1rem', color: '#1f2937' }}>
                Active SOS Incidents
              </h2>
              <span style={{ background: incidents.length > 0 ? '#fee2e2' : '#e5e7eb', color: incidents.length > 0 ? '#991b1b' : '#374151', padding: '0.1rem 0.45rem', borderRadius: '999px', fontSize: '0.725rem', fontWeight: 'bold' }}>
                {incidents.filter((i) => i.status !== 'resolved').length} Active
              </span>
            </div>

            {incidents.filter((i) => i.status !== 'resolved').length === 0 ? (
              <div style={{ background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: '6px', padding: '0.85rem', textAlign: 'center', color: '#6b7280', fontSize: '0.825rem' }}>
                No active SOS incidents reported.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '220px', overflowY: 'auto' }}>
                {incidents.filter((i) => i.status !== 'resolved').map((inc) => (
                  <div
                    key={inc.id}
                    style={{
                      borderLeft: '4px solid #dc2626',
                      background: '#fffbfb',
                      padding: '0.55rem',
                      borderRadius: '4px',
                      border: '1px solid #fee2e2',
                      fontSize: '0.825rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 'bold', color: '#991b1b' }}>
                        #{inc.id} {inc.type === 'medical' ? '🚑 Medical' : inc.type === 'lost' ? '🔍 Lost Person' : '⚠️ Crowd'}
                      </span>
                      <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '0.7rem', fontWeight: 'bold', padding: '0.1rem 0.35rem', borderRadius: '3px', textTransform: 'uppercase' }}>
                        {inc.status}
                      </span>
                    </div>

                    <div style={{ marginTop: '0.25rem', color: '#374151' }}>
                      <strong>Responder:</strong>{' '}
                      <span style={{ color: '#1d4ed8' }}>{inc.responder_name || 'Searching...'}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem', color: '#6b7280', fontSize: '0.75rem' }}>
                      <span>Zone: {inc.zone_name || `Zone ${inc.zone_id || 'N/A'}`}</span>
                      <span>{new Date(inc.created_at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Surge Warning Alerts Panel */}
          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <h2 style={{ margin: 0, fontSize: '1rem', color: '#1f2937' }}>
                Surge Warnings
              </h2>
              <span style={{ background: alerts.length > 0 ? '#fef3c7' : '#e5e7eb', color: alerts.length > 0 ? '#92400e' : '#374151', padding: '0.1rem 0.45rem', borderRadius: '999px', fontSize: '0.725rem', fontWeight: 'bold' }}>
                {alerts.length} Warnings
              </span>
            </div>

            {alerts.length === 0 ? (
              <div style={{ background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: '6px', padding: '0.85rem', textAlign: 'center', color: '#6b7280', fontSize: '0.825rem' }}>
                All zones operating within safe thresholds.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    style={{
                      borderLeft: '4px solid #f59e0b',
                      background: '#fffdf5',
                      padding: '0.55rem',
                      borderRadius: '4px',
                      border: '1px solid #fef3c7',
                      fontSize: '0.825rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 'bold', color: '#b45309' }}>
                        ⚠️ {alert.zone_name || `Zone ${alert.zone_id}`}
                      </span>
                      <span style={{ textTransform: 'uppercase', background: '#f59e0b', color: '#fff', fontSize: '0.65rem', fontWeight: 'bold', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>
                        {alert.level}
                      </span>
                    </div>

                    <div style={{ color: '#1f2937', marginTop: '0.25rem' }}>
                      {alert.message_en}
                    </div>

                    {alert.suggested_action && (
                      <div style={{ marginTop: '0.35rem', padding: '0.35rem 0.5rem', background: '#fef3c7', borderRadius: '4px', border: '1px solid #fde68a' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#92400e', textTransform: 'uppercase' }}>
                          Suggested Action:
                        </div>
                        <div style={{ fontSize: '0.775rem', color: '#78350f', fontWeight: '500', marginTop: '0.1rem' }}>
                          {alert.suggested_action}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary grid below map */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
        {zones.map((zone) => {
          const colors = getZoneColor(zone.level);
          return (
            <div
              key={zone.zone_id}
              style={{
                borderLeft: `4px solid ${colors.color}`,
                background: '#fff',
                padding: '0.75rem',
                borderRadius: '6px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#111827' }}>{zone.name}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.35rem', fontSize: '0.825rem' }}>
                <span>Count: {zone.count.toLocaleString()}</span>
                <span style={{ fontWeight: '600', color: colors.color }}>{zone.density} / m²</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem', fontSize: '0.775rem', color: '#6b7280' }}>
                <span>20-min Forecast:</span>
                <span style={{ fontWeight: '600', color: zone.forecast_density >= 4.0 ? '#dc2626' : '#2563eb' }}>
                  {zone.forecast_density !== null ? `${zone.forecast_density} / m²` : '...'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
