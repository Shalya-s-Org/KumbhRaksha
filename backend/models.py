from typing import Optional
from pydantic import BaseModel

class ZoneOut(BaseModel):
    id: int
    name: str
    lat: float
    lng: float
    area_m2: float
    baseline_count: Optional[int] = 0

class ResponderOut(BaseModel):
    id: int
    name: str
    kind: str
    lat: float
    lng: float
    status: str

class LandmarkOut(BaseModel):
    code: str
    zone_id: int
    lat: float
    lng: float
    label: str

class CrowdCurrentOut(BaseModel):
    zone_id: int
    name: str
    lat: float
    lng: float
    area_m2: float
    count: int
    density: float
    level: str
    forecast_density: Optional[float] = None
    forecast_level: Optional[str] = None

class ScenarioRequest(BaseModel):
    scenario: str
    zone_id: Optional[int] = None

class AlertOut(BaseModel):
    id: int
    zone_id: int
    zone_name: Optional[str] = None
    level: str
    message_en: Optional[str] = None
    message_hi: Optional[str] = None
    message_mr: Optional[str] = None
    suggested_action: Optional[str] = None
    created_at: str
    active: int
