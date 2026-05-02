# 🏗️ FocusForge Architecture Documentation

This document outlines the architectural design, data flow, and technical decisions behind the FocusForge Backend, specifically optimized for the Chrome Extension ecosystem.

## 1. System Overview
FocusForge follows a **Layered Monolithic Architecture**. It is designed to be a high-throughput, stateless REST API that manages the gamified lifecycle of focus sessions and social productivity features.

### Architecture Diagram (High Level)
```mermaid
graph TD
    Client[Chrome Extension] -->|HTTPS/REST| API[Express API Layer]
    API -->|Auth Middleware| Auth[JWT/Bcrypt Validator]
    API -->|Business Logic| Controllers[Route Handlers]
    Controllers -->|Atomic Update| DB[(MongoDB Atlas)]
    
    subgraph "Logic Modules"
        Sess[Session Management]
        Sqd[Social Squads]
        Blk[Blocklist Engine]
        XP[XP & Leveling System]
    end
    
    Controllers --- Sess
    Controllers --- Sqd
    Controllers --- Blk
    Controllers --- XP
```

## 2. Core Modules

### A. Session Engine (`routes/sessions.js`)
Handles the lifecycle of a focus block. 
- **Start**: Initializes a session timestamp.
- **Incremental Sync**: During an active session, the extension sends a strict **delta payload** (`{ xpDelta: 1 }`) to `/api/xp/add-xp` every 60 seconds. This ensures XP and `totalFocusMinutes` are updated atomically in real-time.
- **End**: Marks the session as completed and updates streak logic. **Crucially, it no longer awards XP at this stage** to prevent double-counting (since XP was already accumulated via minute-ticks).
- **Fail/Abort**: Marks the session as failed. Future iterations may implement XP rollbacks for failed sessions.

### B. Identity & Social (`routes/auth.js`, `routes/squads.js`)
- **Stateless Auth**: Uses JWT with a 7-day TTL.
- **Squad Logic**: Competitive clusters where members share `isLive` status and focusXP rankings.

### C. Interception & Blocking (`routes/blocklist.js`, `routes/interceptions.js`)
- **Domain Management**: Synchronized blocklists between the extension and backend.
- **Bypass Registry**: Temporary grace periods (2 mins) for "Stolen Time" after correct mindfulness answers.
- **Interception Logs**: Captures blocked site attempts, categorizing distractions for AI-powered feedback/roasts.

## 3. Real-time State Synchronization

### 📈 Delta-Based XP Sync
To prevent cumulative XP bugs and visual jitter, FocusForge uses a **Strict Delta Sync** mechanism:
1. The extension tracks local session time.
2. Every 60 seconds of focus, it sends `{ xpDelta: 1 }` to the backend.
3. The backend uses MongoDB's `$inc` operator to atomically increment `focusXP` and `totalFocusMinutes`.
4. This ensures that even if a network request is retried or the extension is reloaded, the XP growth remains linear and accurate.

## 4. Extended Data Model

### User Schema (Central)
| Field | Type | Description |
|-------|------|-------------|
| `username` | String | Unique identity |
| `focusXP` | Number | Experience points |
| `level` | Number | Calculated: `floor(XP/100) + 1` |
| `currentStreak`| Number | Daily focus consistency |
| `hardModeEnabled`| Boolean| If true, failures have higher penalties |
| `squadId` | ObjectId | Reference to the user's squad |

### Supporting Schemas
- **FocusSession**: Tracks start/end, status, and XP yield.
- **Squad**: Manages member lists, live statuses, and ownership.
- **Blocklist**: Per-user domain arrays.
- **InterceptionLog**: Detailed records of blocked domain hits and resolution status.

## 5. Architectural Decisions

### 🛡️ Chrome Extension CORS
The API implements a dynamic CORS policy that recognizes and trusts `chrome-extension://` origins, facilitating secure communication from the browser's background and sidepanel scripts.

### ⚡ Gamification Logic (XP/Leveling)
The backend enforces dynamic leveling. Instead of client-side calculation, the server re-evaluates levels during XP updates to ensure consistency and prevent tampering.

### 🔄 Streak Persistence
Streak logic is calculated server-side. When a session completes, the system compares `lastFocusDate` to the current date. If the gap is exactly 1 day, the streak increments; if larger, it resets.

---
*Last Updated: May 2026 (Extension Refactor)*
