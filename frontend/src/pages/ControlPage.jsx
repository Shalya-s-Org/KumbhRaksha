import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Circle, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchCrowdCurrent, fetchAlerts, triggerScenario } from '../api';

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

export default function ControlPage() {
  const [zones, setZones] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedZoneId, setSelectedZoneId] = useState('1');
  const [scenarioStatus, setScenarioStatus] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const [crowdData, alertData] = await Promise.all([
        fetchCrowdCurrent(),
        fetchAlerts(true),
      ]);
      setZones(crowdData);
      setAlerts(alertData);
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
      const res = await triggerScenario('surge', zoneIdNum);
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
            Live simulation polling (3s) • Last tick: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'connecting...'}
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
        </div>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.75rem', borderRadius: '6px', marginBottom: '0.75rem' }}>
          <strong>Communication Error:</strong> {error}
        </div>
      )}

      {/* Main Grid: Map on Left, Control Panel & Alerts on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(320px, 1fr)', gap: '1rem' }}>
        {/* Left Column: Leaflet Map */}
        <div style={{ height: '72vh', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
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

            {zones.map((zone) => {
              const colors = getZoneColor(zone.level);
              const radius = Math.max(65, Math.min(130, Math.sqrt(zone.area_m2 / Math.PI)));

              return (
                <Circle
                  key={zone.zone_id}
                  center={[zone.lat, zone.lng]}
                  radius={radius}
                  pathOptions={{
                    color: colors.color,
                    fillColor: colors.fillColor,
                    fillOpacity: 0.55,
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
          </MapContainer>
        </div>

        {/* Right Column: Demo Controls & Surge Warning Alerts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '72vh', overflowY: 'auto' }}>
          {/* Demo Scenario Controller Card */}
          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.05rem', color: '#1f2937' }}>
              Demo Scenario Controller
            </h2>
            <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.825rem', color: '#4b5563' }}>
              Simulate crowd surge on cue during demonstration to trigger the 20-minute predictive forecast warning.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <label style={{ fontSize: '0.825rem', fontWeight: '600', color: '#374151' }}>
                Select Target Zone:
                <select
                  value={selectedZoneId}
                  onChange={(e) => setSelectedZoneId(e.target.value)}
                  style={{ display: 'block', width: '100%', marginTop: '0.25rem', padding: '0.4rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                >
                  {zones.map((z) => (
                    <option key={z.zone_id} value={z.zone_id}>
                      Zone {z.zone_id}: {z.name} (Density: {z.density}/m²)
                    </option>
                  ))}
                </select>
              </label>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
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
                    padding: '0.5rem 0.75rem',
                    fontWeight: 'bold',
                    fontSize: '0.85rem',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 1px 2px rgba(220,38,38,0.2)',
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
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.85rem',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  Reset
                </button>
              </div>

              {scenarioStatus && (
                <div style={{ fontSize: '0.8rem', background: '#ecfdf5', color: '#065f46', padding: '0.4rem 0.6rem', borderRadius: '4px', marginTop: '0.25rem' }}>
                  {scenarioStatus}
                </div>
              )}
            </div>
          </div>

          {/* Active Surge Warning Alerts Panel */}
          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem', flex: '1', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem', color: '#1f2937' }}>
                Surge Warnings & Alerts
              </h2>
              <span style={{ background: alerts.length > 0 ? '#fee2e2' : '#e5e7eb', color: alerts.length > 0 ? '#991b1b' : '#374151', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                {alerts.length} Active
              </span>
            </div>

            {alerts.length === 0 ? (
              <div style={{ background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: '6px', padding: '1.25rem', textAlign: 'center', color: '#6b7280', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                All zones operating within safe density thresholds. No active warnings.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    style={{
                      borderLeft: '4px solid #dc2626',
                      background: '#fff5f5',
                      padding: '0.75rem',
                      borderRadius: '4px',
                      border: '1px solid #fecaca',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 'bold', color: '#991b1b', fontSize: '0.9rem' }}>
                        ⚠️ {alert.zone_name || `Zone ${alert.zone_id}`}
                      </span>
                      <span style={{ textTransform: 'uppercase', background: '#dc2626', color: '#fff', fontSize: '0.675rem', fontWeight: 'bold', padding: '0.1rem 0.4rem', borderRadius: '3px' }}>
                        {alert.level}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.825rem', color: '#1f2937', marginTop: '0.35rem', lineHeight: '1.3' }}>
                      {alert.message_en}
                    </div>

                    {alert.suggested_action && (
                      <div style={{ marginTop: '0.45rem', padding: '0.45rem 0.6rem', background: '#fef3c7', borderRadius: '4px', border: '1px solid #fde68a' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#92400e', textTransform: 'uppercase' }}>
                          Suggested Action:
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#78350f', fontWeight: '500', marginTop: '0.15rem' }}>
                          {alert.suggested_action}
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: '0.35rem', fontSize: '0.725rem', color: '#9ca3af', textAlign: 'right' }}>
                      {new Date(alert.created_at).toLocaleTimeString()}
                    </div>
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
