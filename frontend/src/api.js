const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export async function checkHealth() {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }
  return response.json();
}

export async function fetchCrowdCurrent() {
  const response = await fetch(`${API_BASE_URL}/crowd/current`);
  if (!response.ok) {
    throw new Error(`Failed to fetch current crowd data: ${response.status}`);
  }
  return response.json();
}

export async function fetchAlerts(activeOnly = true) {
  const response = await fetch(`${API_BASE_URL}/alerts?active_only=${activeOnly}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch alerts: ${response.status}`);
  }
  return response.json();
}

export async function triggerScenario(scenario, zoneId = null) {
  const payload = { scenario };
  if (zoneId !== null && zoneId !== undefined) {
    payload.zone_id = parseInt(zoneId, 10);
  }
  const response = await fetch(`${API_BASE_URL}/simulator/scenario`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Failed to trigger scenario: ${response.status}`);
  }
  return response.json();
}

export default {
  checkHealth,
  fetchCrowdCurrent,
  fetchAlerts,
  triggerScenario,
};
