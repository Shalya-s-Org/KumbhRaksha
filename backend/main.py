import os
from contextlib import asynccontextmanager
from typing import List
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from backend.database import init_db, get_connection
from backend.models import ZoneOut, ResponderOut, LandmarkOut, CrowdCurrentOut
from backend.simulator import start_simulator, stop_simulator, get_current_crowd

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
    """Get current simulated crowd count and density levels across all zones."""
    return get_current_crowd()
