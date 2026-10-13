import math
from datetime import datetime, timezone
from typing import Optional, Tuple, Dict, Any
from backend.database import get_connection

def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    Calculate the great circle distance between two points on Earth in meters using Haversine formula.
    """
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))
    return R * c

def get_preferred_responder_kind(incident_type: str) -> Optional[str]:
    """Map incident type to preferred responder kind."""
    mapping = {
        "medical": "medical",
        "lost": "volunteer",
        "crowd": "police",
    }
    return mapping.get(incident_type.lower())

def find_nearest_responder(
    conn,
    lat: float,
    lng: float,
    incident_type: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Find the nearest available responder based on haversine distance.
    Prioritizes matching responder kind for the incident type, falling back
    to any available responder if no preferred type is available.
    """
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, name, kind, lat, lng, status FROM responders WHERE status = 'available'"
    )
    available = cursor.fetchall()
    if not available:
        return None

    preferred_kind = get_preferred_responder_kind(incident_type) if incident_type else None

    # Filter by preferred kind first if available
    candidates = [r for r in available if r["kind"] == preferred_kind]
    if not candidates:
        candidates = available  # Fallback to any available responder

    best_responder = None
    min_dist = float("inf")

    for r in candidates:
        dist = haversine_distance(lat, lng, r["lat"], r["lng"])
        if dist < min_dist:
            min_dist = dist
            best_responder = dict(r)
            best_responder["distance_meters"] = round(dist, 1)

    return best_responder

def create_incident(
    conn,
    incident_type: str,
    source: str,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    landmark_code: Optional[str] = None,
    zone_id: Optional[int] = None,
    phone: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Create incident, resolve landmark coordinates if needed, assign nearest responder, and save to SQLite.
    """
    cursor = conn.cursor()

    # If coordinates are missing but landmark_code is provided, resolve from landmark_codes table
    if (lat is None or lng is None) and landmark_code:
        cursor.execute(
            "SELECT zone_id, lat, lng FROM landmark_codes WHERE code = ?",
            (landmark_code.strip().upper(),),
        )
        lm = cursor.fetchone()
        if lm:
            lat = lm["lat"]
            lng = lm["lng"]
            if zone_id is None:
                zone_id = lm["zone_id"]

    # Fallback to default Ramkund coordinates if neither was provided
    if lat is None or lng is None:
        lat = 20.0067
        lng = 73.7915

    # If zone_id is still unknown, assign to nearest zone
    if zone_id is None:
        cursor.execute("SELECT id, lat, lng FROM zones")
        zones = cursor.fetchall()
        nearest_zone = None
        closest_zone_dist = float("inf")
        for z in zones:
            d = haversine_distance(lat, lng, z["lat"], z["lng"])
            if d < closest_zone_dist:
                closest_zone_dist = d
                nearest_zone = z["id"]
        zone_id = nearest_zone

    # Find nearest available responder
    responder = find_nearest_responder(conn, lat, lng, incident_type)
    responder_id = responder["id"] if responder else None
    status = "assigned" if responder else "open"

    now_iso = datetime.now(timezone.utc).isoformat()

    cursor.execute(
        """
        INSERT INTO incidents (type, source, lat, lng, zone_id, phone, status, responder_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            incident_type,
            source,
            lat,
            lng,
            zone_id,
            phone or "",
            status,
            responder_id,
            now_iso,
        ),
    )
    incident_id = cursor.lastrowid

    # Mark responder busy if assigned
    if responder_id:
        cursor.execute(
            "UPDATE responders SET status = 'busy' WHERE id = ?",
            (responder_id,),
        )

    conn.commit()

    return {
        "id": incident_id,
        "type": incident_type,
        "source": source,
        "lat": lat,
        "lng": lng,
        "zone_id": zone_id,
        "phone": phone or "",
        "status": status,
        "responder_id": responder_id,
        "responder": responder,
        "created_at": now_iso,
    }
