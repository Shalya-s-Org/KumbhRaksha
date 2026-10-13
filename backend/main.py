import os
import secrets
import uuid
from datetime import datetime, timezone
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
    AlertPublicOut,
    IncidentCreate,
    IncidentUpdate,
    IncidentOut,
    FamilyCreate,
    FamilyOut,
    MemberOut,
    MemberDetailsOut,
    ReportCreate,
    ReportUpdate,
    ReportOut,
    ReportMatchOut,
    ReuniteRequest,
)
from backend.matching import find_suggested_matches
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
               a.suggested_action, a.created_at, a.active, a.broadcasted
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

@app.post("/alerts/{alert_id}/broadcast")
def broadcast_alert(alert_id: int):
    """Broadcast an alert to pilgrims and the public portal."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM alerts WHERE id = ?", (alert_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Alert not found")

    cursor.execute("UPDATE alerts SET broadcasted = 1 WHERE id = ?", (alert_id,))
    conn.commit()
    conn.close()
    return {"status": "ok", "alert_id": alert_id, "broadcasted": True}

@app.get("/alerts/public", response_model=List[AlertPublicOut])
def get_public_alerts(lang: str = "en"):
    """List active broadcasted public alerts in requested language (en, hi, mr)."""
    lang_code = lang.lower().strip()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT a.id, a.zone_id, z.name as zone_name, a.level,
               a.message_en, a.message_hi, a.message_mr,
               a.suggested_action, a.created_at
        FROM alerts a
        LEFT JOIN zones z ON a.zone_id = z.id
        WHERE a.active = 1 AND a.broadcasted = 1
        ORDER BY a.id DESC
        """
    )
    rows = cursor.fetchall()
    conn.close()

    result = []
    for r in rows:
        if lang_code == "mr":
            msg = r["message_mr"] or r["message_en"]
        elif lang_code == "hi":
            msg = r["message_hi"] or r["message_en"]
        else:
            msg = r["message_en"] or ""

        result.append(
            AlertPublicOut(
                id=r["id"],
                zone_id=r["zone_id"],
                zone_name=r["zone_name"],
                level=r["level"],
                message=msg,
                suggested_action=r["suggested_action"],
                created_at=r["created_at"],
                lang=lang_code,
            )
        )
    return result

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

@app.post("/families", response_model=FamilyOut)
def create_family(body: FamilyCreate):
    """Create a pilgrim family safety group and generate unique QR tokens for each member."""
    conn = get_connection()
    cursor = conn.cursor()

    family_code = f"FAM-{secrets.token_hex(3).upper()}"
    now_iso = datetime.now(timezone.utc).isoformat()

    cursor.execute(
        """
        INSERT INTO families (code, head_name, phone, created_at)
        VALUES (?, ?, ?, ?)
        """,
        (family_code, body.head_name.strip(), body.phone.strip(), now_iso),
    )
    family_id = cursor.lastrowid

    created_members = []
    for m in body.members:
        token = f"tok-{uuid.uuid4().hex[:10]}"
        cursor.execute(
            """
            INSERT INTO members (family_id, name, age, relation, medical_note, qr_token)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                family_id,
                m.name.strip(),
                m.age,
                (m.relation or "").strip(),
                (m.medical_note or "").strip(),
                token,
            ),
        )
        member_id = cursor.lastrowid
        created_members.append(
            MemberOut(
                id=member_id,
                family_id=family_id,
                name=m.name.strip(),
                age=m.age,
                relation=(m.relation or "").strip(),
                medical_note=(m.medical_note or "").strip(),
                qr_token=token,
            )
        )

    conn.commit()
    conn.close()

    return FamilyOut(
        id=family_id,
        code=family_code,
        head_name=body.head_name.strip(),
        phone=body.phone.strip(),
        created_at=now_iso,
        members=created_members,
    )

@app.get("/families/{code}", response_model=FamilyOut)
def get_family_by_code(code: str):
    """Retrieve family details and member list by family code."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, code, head_name, phone, created_at FROM families WHERE code = ?",
        (code.strip().upper(),),
    )
    fam = cursor.fetchone()
    if not fam:
        conn.close()
        raise HTTPException(status_code=404, detail="Family not found")

    family_id = fam["id"]
    cursor.execute(
        """
        SELECT id, family_id, name, age, relation, medical_note, qr_token
        FROM members
        WHERE family_id = ?
        ORDER BY id ASC
        """,
        (family_id,),
    )
    members_rows = cursor.fetchall()
    conn.close()

    members = [MemberOut(**dict(m)) for m in members_rows]
    return FamilyOut(
        id=fam["id"],
        code=fam["code"],
        head_name=fam["head_name"],
        phone=fam["phone"],
        created_at=fam["created_at"],
        members=members,
    )

@app.get("/members/by-token/{token}", response_model=MemberDetailsOut)
def get_member_by_token(token: str):
    """Volunteer lookup: retrieve pilgrim member identity, medical notes, and family head contact by QR token."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT m.id, m.family_id, f.code as family_code, f.head_name, f.phone as head_phone,
               m.name, m.age, m.relation, m.medical_note, m.qr_token
        FROM members m
        JOIN families f ON m.family_id = f.id
        WHERE m.qr_token = ?
        """,
        (token.strip(),),
    )
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Member QR token not found")

    return dict(row)

@app.post("/reports", response_model=ReportOut)
def create_report(body: ReportCreate):
    """File a missing or found person report with consent."""
    conn = get_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()

    cursor.execute(
        """
        INSERT INTO missing_reports (kind, name, age, description, reporter_phone, member_id, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'open', ?)
        """,
        (
            body.kind.strip().lower(),
            body.name.strip(),
            body.age,
            (body.description or "").strip(),
            (body.reporter_phone or "").strip(),
            body.member_id,
            now_iso,
        ),
    )
    report_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return ReportOut(
        id=report_id,
        kind=body.kind.strip().lower(),
        name=body.name.strip(),
        age=body.age,
        description=(body.description or "").strip(),
        reporter_phone=(body.reporter_phone or "").strip(),
        member_id=body.member_id,
        status="open",
        created_at=now_iso,
    )

@app.get("/reports", response_model=List[ReportOut])
def list_reports(kind: Optional[str] = None, status: Optional[str] = None):
    """List missing and found person reports."""
    conn = get_connection()
    cursor = conn.cursor()
    query = "SELECT id, kind, name, age, description, reporter_phone, member_id, status, created_at FROM missing_reports"
    conditions = []
    params = []

    if kind:
        conditions.append("kind = ?")
        params.append(kind.strip().lower())
    if status:
        conditions.append("status = ?")
        params.append(status.strip().lower())

    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += " ORDER BY id DESC"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [ReportOut(**dict(r)) for r in rows]

@app.get("/reports/matches", response_model=List[ReportMatchOut])
def get_report_matches():
    """Retrieve suggested matches between open lost reports and found reports."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT id, kind, name, age, description, reporter_phone, member_id, status, created_at FROM missing_reports WHERE kind = 'lost' AND status = 'open'"
    )
    lost_rows = [dict(r) for r in cursor.fetchall()]

    cursor.execute(
        "SELECT id, kind, name, age, description, reporter_phone, member_id, status, created_at FROM missing_reports WHERE kind = 'found' AND status = 'open'"
    )
    found_rows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    suggested = find_suggested_matches(lost_rows, found_rows, min_score=35)
    result = []
    for m in suggested:
        result.append(
            ReportMatchOut(
                lost=ReportOut(**m["lost"]),
                found=ReportOut(**m["found"]),
                score=m["score"],
                reasons=m["reasons"],
            )
        )
    return result

@app.patch("/reports/{report_id}", response_model=ReportOut)
def update_report(report_id: int, body: ReportUpdate):
    """Update report status (e.g. 'reunited')."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, kind, name, age, description, reporter_phone, member_id, status, created_at FROM missing_reports WHERE id = ?",
        (report_id,),
    )
    existing = cursor.fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Report not found")

    new_status = body.status if body.status is not None else existing["status"]
    cursor.execute(
        "UPDATE missing_reports SET status = ? WHERE id = ?",
        (new_status, report_id),
    )
    conn.commit()

    cursor.execute(
        "SELECT id, kind, name, age, description, reporter_phone, member_id, status, created_at FROM missing_reports WHERE id = ?",
        (report_id,),
    )
    row = cursor.fetchone()
    conn.close()
    return ReportOut(**dict(row))

@app.post("/reports/reunite")
def reunite_reports(body: ReuniteRequest):
    """Mark both matched lost and found reports as reunited."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE missing_reports SET status = 'reunited' WHERE id = ?", (body.lost_id,))
    cursor.execute("UPDATE missing_reports SET status = 'reunited' WHERE id = ?", (body.found_id,))
    conn.commit()
    conn.close()
    return {
        "status": "ok",
        "message": "Reports marked as reunited",
        "lost_id": body.lost_id,
        "found_id": body.found_id,
    }
