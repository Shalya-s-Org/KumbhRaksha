# KumbhRaksha System Architecture

KumbhRaksha provides a unified backend architecture with dual user-facing interfaces and simulation tools tailored for high-density, low-connectivity mass gatherings at the Nashik-Trimbakeshwar Simhastha Kumbh Mela.

## Architecture Diagram

```mermaid
flowchart TD
    subgraph Clients["Client Interfaces"]
        Pilgrim["Pilgrim Web App (/pilgrim)<br/>• Mobile PWA, Multilingual<br/>• SOS, Family Group QR, Audio"]
        Control["Control Room Dashboard (/control)<br/>• Crowd Heatmap & Forecast<br/>• Surge Alerts & Incident Dispatch"]
        Volunteer["Volunteer Scanner (/scan/:token)<br/>• Wristband QR Scan<br/>• Contact & Medical Summary"]
        ChatSim["Chat Simulator (/chat-sim)<br/>• Fake SMS / WhatsApp UI<br/>• Keyword Command Parser"]
    end

    subgraph Backend["FastAPI Backend (Port 8000)"]
        Router["FastAPI Application & Routers"]
        Sim["Crowd Simulator (Background Task)<br/>• 3s tick = 1 min simulated time<br/>• Density Drift & Scenarios"]
        Forecast["Forecast Engine<br/>• Linear Regression (scikit-learn)<br/>• 20-tick Lookahead Alerting"]
        DB[(SQLite Database<br/>• Zones, Crowd Readings<br/>• Alerts, Incidents, Responders<br/>• Families, Members, Reports)]
    end

    Pilgrim -->|HTTP Poll (3s) / POST| Router
    Control -->|HTTP Poll (3s) / POST| Router
    Volunteer -->|GET /members/by-token| Router
    ChatSim -->|POST /chat/message| Router

    Router --> DB
    Sim -->|Record Density Readings| DB
    Forecast -->|Fit Readings & Trigger Alerts| DB
    Forecast --> Router
```

## Core Components

1. **FastAPI Backend (`backend/`)**:
   - Single source of truth serving both REST APIs and background tasks.
   - Background crowd simulator generating periodic density readings per zone.
   - scikit-learn forecasting model predicting 20-minute forward densities to trigger early surge warnings.
   - SQLite persistent store for low operational overhead.

2. **Pilgrim Interface (`/pilgrim`)**:
   - Lightweight, mobile-first progressive web app designed for weak cellular connectivity and high crowd density.
   - Local-language support (English, Hindi, Marathi) with Web Speech API audio announcements.
   - Rapid emergency SOS dispatch with automatic landmark fallback.

3. **Command & Control Dashboard (`/control`)**:
   - High-density tactical overview for emergency response coordinators, police, and medical personnel.
   - Interactive crowd density map with alert badges, active SOS incidents, nearest responder haversine assignment, and lost-and-found report matching.

4. **Volunteer Scanner (`/scan/:token`)**:
   - Rapid volunteer interface to scan physical QR wristbands on elderly individuals or children, immediately retrieving family contacts and critical medical notes.

5. **Chat Simulator (`/chat-sim`)**:
   - Demonstrates emergency reporting over basic SMS/WhatsApp channels via standard text keyword parsing (`SOS`, `LOST`, `FOUND`, `JOIN`, `LANG`).
