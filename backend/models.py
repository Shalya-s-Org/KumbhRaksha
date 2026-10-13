from typing import Optional, List
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
    broadcasted: Optional[int] = 0

class AlertPublicOut(BaseModel):
    id: int
    zone_id: int
    zone_name: Optional[str] = None
    level: str
    message: str
    suggested_action: Optional[str] = None
    created_at: str
    lang: str

class IncidentCreate(BaseModel):
    type: str  # "medical" | "lost" | "crowd"
    source: str = "web"  # "web" | "chat"
    lat: Optional[float] = None
    lng: Optional[float] = None
    landmark_code: Optional[str] = None
    zone_id: Optional[int] = None
    phone: Optional[str] = None

class IncidentUpdate(BaseModel):
    status: Optional[str] = None  # "open" | "assigned" | "resolved"
    responder_id: Optional[int] = None

class IncidentOut(BaseModel):
    id: int
    type: str
    source: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    zone_id: Optional[int] = None
    zone_name: Optional[str] = None
    phone: Optional[str] = None
    status: str
    responder_id: Optional[int] = None
    responder_name: Optional[str] = None
    responder_kind: Optional[str] = None
    created_at: str

class MemberCreate(BaseModel):
    name: str
    age: int
    relation: Optional[str] = ""
    medical_note: Optional[str] = ""

class FamilyCreate(BaseModel):
    head_name: str
    phone: str
    members: List[MemberCreate] = []

class MemberOut(BaseModel):
    id: int
    family_id: int
    name: str
    age: int
    relation: Optional[str] = ""
    medical_note: Optional[str] = ""
    qr_token: str

class FamilyOut(BaseModel):
    id: int
    code: str
    head_name: str
    phone: str
    created_at: str
    members: List[MemberOut] = []

class MemberDetailsOut(BaseModel):
    id: int
    family_id: int
    family_code: str
    head_name: str
    head_phone: str
    name: str
    age: int
    relation: Optional[str] = ""
    medical_note: Optional[str] = ""
    qr_token: str
