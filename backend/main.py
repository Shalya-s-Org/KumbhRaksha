import os
from contextlib import asynccontextmanager
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from backend.database import init_db, get_connection
from backend.models import (
    ZoneOut,
    ResponderOut,
    LandmarkOut,
    CrowdCurrentOut,
    ScenarioRequest,
    AlertOut,
    IncidentCreate,
    IncidentUpdate,
    IncidentOut,
)
from backend.simulator import (
    start_simulator,
    stop_simulator,
    get_current_crowd,
    set_scenario,
)
from backend.dispatch import create_incident

# Load environment variables
load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database schema is initialized on startup
    init_db()
    # Start background crowd simulator
    start_simulator()
    yield
    # Stop background crowd simulator on shutdown
    stop_simulator()

app = FastAPI(
    title="KumbhRaksha API",
    description="Safety and Crowd Management Platform for Kumbh Mela",
    version="0.1.0",
    lifespan=lifespan,
)

cors_origins_str = os.getenv("CORS_ORIGINS", "http://localhost:5173")
cors_origins = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins if cors_origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    """Health check endpoint to verify backend service status."""
    return {"status": "ok"}

@app.get("/zones", response_model=List[ZoneOut])
def get_zones():
    """List all crowd monitoring zones."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, lat, lng, area_m2, baseline_count FROM zones ORDER BY id ASC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.get("/responders", response_model=List[ResponderOut])
def get_responders():
    """List all emergency responders and status."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, kind, lat, lng, status FROM responders ORDER BY id ASC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.get("/landmarks", response_model=List[LandmarkOut])
def get_landmarks():
    """List all landmark location reference codes."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT code, zone_id, lat, lng, label FROM landmark_codes ORDER BY code ASC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.get("/crowd/current", response_model=List[CrowdCurrentOut])
def get_crowd_current():
    """Get current simulated crowd count, density, and 20-tick forecast across all zones."""
    return get_current_crowd()

@app.post("/simulator/scenario")
def trigger_scenario(body: ScenarioRequest):
    """Trigger simulator demo scenario ('surge' or 'reset')."""
    return set_scenario(body.scenario, body.zone_id)

@app.get("/alerts", response_model=List[AlertOut])
def get_alerts(active_only: bool = True):
    """List system alerts, default active alerts only."""
    conn = get_connection()
    cursor = conn.cursor()
    query = """
        SELECT a.id, a.zone_id, z.name as zone_name, a.level, a.message_en, a.message_hi, a.message_mr,
               a.suggested_action, a.created_at, a.active
        FROM alerts a
        LEFT JOIN zones z ON a.zone_id = z.id
    """
    if active_only:
        query += " WHERE a.active = 1"
    query += " ORDER BY a.id DESC"
    cursor.execute(query)
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.post("/incidents", response_model=IncidentOut)
def report_incident(body: IncidentCreate):
    """Report an emergency SOS incident and assign nearest available responder."""
    conn = get_connection()
    res = create_incident(
        conn=conn,
        incident_type=body.type,
        source=body.source,
        lat=body.lat,
        lng=body.lng,
        landmark_code=body.landmark_code,
        zone_id=body.zone_id,
        phone=body.phone,
    )
    incident_id = res["id"]

    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT i.id, i.type, i.source, i.lat, i.lng, i.zone_id, z.name as zone_name,
               i.phone, i.status, i.responder_id, r.name as responder_name, r.kind as responder_kind,
               i.created_at
        FROM incidents i
        LEFT JOIN responders r ON i.responder_id = r.id
        LEFT JOIN zones z ON i.zone_id = z.id
        WHERE i.id = ?
        """,
        (incident_id,),
    )
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=500, detail="Failed to retrieve created incident")
    return dict(row)

@app.get("/incidents", response_model=List[IncidentOut])
def list_incidents(status: Optional[str] = None):
    """List all reported emergency incidents with assigned responder details."""
    conn = get_connection()
    cursor = conn.cursor()
    query = """
        SELECT i.id, i.type, i.source, i.lat, i.lng, i.zone_id, z.name as zone_name,
               i.phone, i.status, i.responder_id, r.name as responder_name, r.kind as responder_kind,
               i.created_at
        FROM incidents i
        LEFT JOIN responders r ON i.responder_id = r.id
        LEFT JOIN zones z ON i.zone_id = z.id
    """
    params = []
    if status:
        query += " WHERE i.status = ?"
        params.append(status)
    query += " ORDER BY i.id DESC"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.patch("/incidents/{incident_id}", response_model=IncidentOut)
def update_incident(incident_id: int, body: IncidentUpdate):
    """Update incident status or assigned responder."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, status, responder_id FROM incidents WHERE id = ?", (incident_id,))
    existing = cursor.fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Incident not found")

    new_status = body.status if body.status is not None else existing["status"]
    new_resp_id = body.responder_id if body.responder_id is not None else existing["responder_id"]

    cursor.execute(
        "UPDATE incidents SET status = ?, responder_id = ? WHERE id = ?",
        (new_status, new_resp_id, incident_id),
    )

    # If resolved, release responder back to available
    if new_status == "resolved" and existing["responder_id"]:
        cursor.execute(
            "UPDATE responders SET status = 'available' WHERE id = ?",
            (existing["responder_id"],),
        )

    conn.commit()

    cursor.execute(
        """
        SELECT i.id, i.type, i.source, i.lat, i.lng, i.zone_id, z.name as zone_name,
               i.phone, i.status, i.responder_id, r.name as responder_name, r.kind as responder_kind,
               i.created_at
        FROM incidents i
        LEFT JOIN responders r ON i.responder_id = r.id
        LEFT JOIN zones z ON i.zone_id = z.id
        WHERE i.id = ?
        """,
        (incident_id,),
    )
    row = cursor.fetchone()
    conn.close()
    return dict(row)
