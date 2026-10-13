import asyncio
import os
import random
import time
from typing import Dict, List, Optional
from backend.database import get_connection

# In-memory simulator state
_zone_counts: Dict[int, int] = {}
_is_running = False
_task: Optional[asyncio.Task] = None

def get_density_level(density: float) -> str:
    """Return density level category according to SPEC.md section 6."""
    if density < 2.0:
        return "safe"
    elif density <= 4.0:
        return "caution"
    else:
        return "danger"

def init_simulator_state() -> None:
    """Initialize in-memory counts from zones table baseline_count if empty."""
    global _zone_counts
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, baseline_count FROM zones")
    rows = cursor.fetchall()
    conn.close()

    for row in rows:
        z_id = row["id"]
        if z_id not in _zone_counts:
            base = row["baseline_count"] if row["baseline_count"] else 3000
            _zone_counts[z_id] = base

def step_simulation() -> List[dict]:
    """Execute one simulation tick: drift counts, insert crowd_readings, return latest readings."""
    global _zone_counts
    init_simulator_state()

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, lat, lng, area_m2 FROM zones ORDER BY id ASC")
    zones = cursor.fetchall()

    ts = time.time()
    readings = []

    for z in zones:
        z_id = z["id"]
        current = _zone_counts.get(z_id, 3000)

        # Drift randomly: small noise (-25 to +25)
        drift = random.randint(-25, 25)
        new_count = max(50, current + drift)
        _zone_counts[z_id] = new_count

        cursor.execute(
            "INSERT INTO crowd_readings (zone_id, ts, count) VALUES (?, ?, ?)",
            (z_id, ts, new_count),
        )

        area = z["area_m2"] if z["area_m2"] > 0 else 1.0
        density = round(new_count / area, 2)
        level = get_density_level(density)

        readings.append({
            "zone_id": z_id,
            "name": z["name"],
            "lat": z["lat"],
            "lng": z["lng"],
            "area_m2": z["area_m2"],
            "count": new_count,
            "density": density,
            "level": level,
            "forecast_density": None,
            "forecast_level": None,
        })

    conn.commit()
    conn.close()
    return readings

def get_current_crowd() -> List[dict]:
    """Return the most recent crowd reading for every zone."""
    init_simulator_state()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, lat, lng, area_m2 FROM zones ORDER BY id ASC")
    zones = cursor.fetchall()

    result = []
    for z in zones:
        z_id = z["id"]
        count = _zone_counts.get(z_id)
        if count is None:
            cursor.execute(
                "SELECT count FROM crowd_readings WHERE zone_id = ? ORDER BY id DESC LIMIT 1",
                (z_id,),
            )
            latest = cursor.fetchone()
            count = latest["count"] if latest else 0
            _zone_counts[z_id] = count

        area = z["area_m2"] if z["area_m2"] > 0 else 1.0
        density = round(count / area, 2)
        level = get_density_level(density)

        result.append({
            "zone_id": z_id,
            "name": z["name"],
            "lat": z["lat"],
            "lng": z["lng"],
            "area_m2": z["area_m2"],
            "count": count,
            "density": density,
            "level": level,
            "forecast_density": None,
            "forecast_level": None,
        })

    conn.close()
    return result

async def run_simulator_loop():
    """Background loop that ticks every SIM_TICK_SECONDS."""
    tick_seconds = float(os.getenv("SIM_TICK_SECONDS", "3"))
    while _is_running:
        try:
            step_simulation()
        except Exception as e:
            print(f"[Simulator Error] {e}")
        await asyncio.sleep(tick_seconds)

def start_simulator():
    """Start the background simulation loop task."""
    global _is_running, _task
    if not _is_running:
        _is_running = True
        # Do one immediate tick so current readings are available immediately
        try:
            step_simulation()
        except Exception as e:
            print(f"[Simulator initial tick warning] {e}")
        _task = asyncio.create_task(run_simulator_loop())

def stop_simulator():
    """Stop the background simulation loop task."""
    global _is_running, _task
    _is_running = False
    if _task:
        _task.cancel()
        _task = None
