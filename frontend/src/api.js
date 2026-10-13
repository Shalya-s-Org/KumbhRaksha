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

export async function broadcastAlert(alertId) {
  const response = await fetch(`${API_BASE_URL}/alerts/${alertId}/broadcast`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Failed to broadcast alert: ${response.status}`);
  }
  return response.json();
}

export async function fetchPublicAlerts(lang = 'en') {
  const response = await fetch(`${API_BASE_URL}/alerts/public?lang=${encodeURIComponent(lang)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch public alerts: ${response.status}`);
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

export async function fetchLandmarks() {
  const response = await fetch(`${API_BASE_URL}/landmarks`);
  if (!response.ok) {
    throw new Error(`Failed to fetch landmarks: ${response.status}`);
  }
  return response.json();
}

export async function reportIncident(incidentData) {
  const response = await fetch(`${API_BASE_URL}/incidents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(incidentData),
  });
  if (!response.ok) {
    throw new Error(`Failed to report incident: ${response.status}`);
  }
  return response.json();
}

export async function fetchIncidents(status = null) {
  const url = status
    ? `${API_BASE_URL}/incidents?status=${encodeURIComponent(status)}`
    : `${API_BASE_URL}/incidents`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch incidents: ${response.status}`);
  }
  return response.json();
}

export async function createFamily(familyData) {
  const response = await fetch(`${API_BASE_URL}/families`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(familyData),
  });
  if (!response.ok) {
    throw new Error(`Failed to create family: ${response.status}`);
  }
  return response.json();
}

export async function fetchFamily(code) {
  const response = await fetch(`${API_BASE_URL}/families/${encodeURIComponent(code)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch family: ${response.status}`);
  }
  return response.json();
}

export async function fetchMemberByToken(token) {
  const response = await fetch(`${API_BASE_URL}/members/by-token/${encodeURIComponent(token)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch member details: ${response.status}`);
  }
  return response.json();
}

export async function fileReport(reportData) {
  const response = await fetch(`${API_BASE_URL}/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reportData),
  });
  if (!response.ok) {
    throw new Error(`Failed to file report: ${response.status}`);
  }
  return response.json();
}

export async function fetchReports(kind = null, status = null) {
  const params = new URLSearchParams();
  if (kind) params.append('kind', kind);
  if (status) params.append('status', status);
  const queryStr = params.toString() ? `?${params.toString()}` : '';

  const response = await fetch(`${API_BASE_URL}/reports${queryStr}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch reports: ${response.status}`);
  }
  return response.json();
}

export async function fetchReportMatches() {
  const response = await fetch(`${API_BASE_URL}/reports/matches`);
  if (!response.ok) {
    throw new Error(`Failed to fetch report matches: ${response.status}`);
  }
  return response.json();
}

export async function reuniteReports(lostId, foundId) {
  const response = await fetch(`${API_BASE_URL}/reports/reunite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lost_id: lostId, found_id: foundId }),
  });
  if (!response.ok) {
    throw new Error(`Failed to reunite reports: ${response.status}`);
  }
  return response.json();
}

export async function updateReportStatus(reportId, status) {
  const response = await fetch(`${API_BASE_URL}/reports/${reportId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    throw new Error(`Failed to update report: ${response.status}`);
  }
  return response.json();
}

export default {
  checkHealth,
  fetchCrowdCurrent,
  fetchAlerts,
  broadcastAlert,
  fetchPublicAlerts,
  triggerScenario,
  fetchLandmarks,
  reportIncident,
  fetchIncidents,
  createFamily,
  fetchFamily,
  fetchMemberByToken,
  fileReport,
  fetchReports,
  fetchReportMatches,
  reuniteReports,
  updateReportStatus,
};

