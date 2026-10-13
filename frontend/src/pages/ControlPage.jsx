import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Circle, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchCrowdCurrent } from '../api';

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
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      const data = await fetchCrowdCurrent();
      setZones(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error('Error fetching crowd data:', err);
      setError(err.message);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  // Map center around Ramkund Ghat, Nashik
  const center = [20.007, 73.793];

  return (
    <div style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        <div>
          <h1 style={{ margin: '0 0 0.25rem 0', fontSize: '1.5rem' }}>Control Room — Live Crowd Map</h1>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            Polling every 3s • Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'connecting...'}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: '#f3f4f6', padding: '0.5rem 1rem', borderRadius: '6px' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 'bold' }}>Density (people/m²):</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
            Safe (&lt; 2)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }}></span>
            Caution (2 - 4)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
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

      {/* Map Container */}
      <div style={{ height: '70vh', width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
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
            // Radius approximated from area: r = sqrt(area / pi) with minimum size for visibility
            const radius = Math.max(65, Math.min(130, Math.sqrt(zone.area_m2 / Math.PI)));

            return (
              <Circle
                key={zone.zone_id}
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
                  <div style={{ minWidth: '160px', fontFamily: 'sans-serif' }}>
                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#111827' }}>{zone.name}</h3>
                    <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>
                      <strong>Count:</strong> {zone.count.toLocaleString()}
                    </p>
                    <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>
                      <strong>Density:</strong> {zone.density} / m²
                    </p>
                    <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>
                      <strong>Status:</strong>{' '}
                      <span
                        style={{
                          textTransform: 'uppercase',
                          fontWeight: 'bold',
                          color: colors.color,
                        }}
                      >
                        {zone.level}
                      </span>
                    </p>
                  </div>
                </Popup>
              </Circle>
            );
          })}
        </MapContainer>
      </div>

      {/* Summary grid below map */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
        {zones.map((zone) => {
          const colors = getZoneColor(zone.level);
          return (
            <div
              key={zone.zone_id}
              style={{
                borderLeft: `4px solid ${colors.color}`,
                background: '#fff',
                padding: '0.75rem',
                borderRadius: '4px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}
            >
              <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{zone.name}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem', fontSize: '0.85rem' }}>
                <span>{zone.count.toLocaleString()} people</span>
                <span style={{ fontWeight: '600', color: colors.color }}>{zone.density} / m²</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
