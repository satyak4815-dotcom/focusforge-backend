# 🛡️ FocusForge Backend (Chrome Extension Edition)

FocusForge is a high-performance productivity suite backend refactored to power a gamified **Chrome Extension**. It handles secure authentication, real-time focus sessions, site blocking logic, and social squad leaderboards using a unified HTTP + WebSocket architecture.

## 🚀 Features

- **Hybrid Real-time Architecture**: Unified Node.js server handling both RESTful API requests and WebSocket "Squad Sync" connections on a single port.
- **Gamified Productivity**: Track focus sessions with unified **Strict Delta XP** (per-minute increments) and dynamic leveling.
- **Delta-Based Synchronization**: Prevents exponential XP inflation by using atomic `$inc` updates for both XP and focus minutes every 60 seconds.
- **Chrome Extension Support**: CORS-optimized for `chrome-extension://` origins with dynamic extension ID support.
- **Site Blocking & Mindfulness**: Manage custom blocklists and log mindfulness interception events.
- **Social Squads**: 
    - **Persistent Squads**: MongoDB-backed groups for long-term XP tracking and membership.
    - **Live Squad Sync (WebSockets)**: Volatile, real-time rooms for ephemeral focus status broadcasting.
- **Digital Wellbeing Stats**: Aggregated data on distraction patterns for AI-powered feedback.
- **Parental Oversight (New)**: 
    - **Parent Portal**: Dedicated model for guardian management.
    - **Detailed Website Monitoring**: Tracks domain URLs, visit frequencies (counts), and exact timestamps for every visit.
- **Robust Security**: JWT-based stateless authentication with Bcrypt password hashing.

## 🛠️ Tech Stack

- **Runtime**: [Node.js](https://nodejs.org/) (>= 18.0.0)
- **Framework**: [Express.js](https://expressjs.com/)
- **Real-time**: [ws (WebSockets)](https://github.com/websockets/ws)
- **Database**: [MongoDB Atlas](https://www.mongodb.com/atlas)
- **ORM**: [Mongoose](https://mongoosejs.com/)
- **Security**: JWT, Bcrypt, CORS (Chrome Extension Optimized)
- **Deployment**: Production-ready for [Render](https://render.com/)

## 📂 Project Structure

```text
FocusForge-Backend/
├── middleware/         # Custom middlewares (Auth validation)
├── models/             # Mongoose schemas (User, Session, Squad, etc.)
├── routes/             # API Route handlers
│   ├── auth.js         # Registration & Login
│   ├── xp.js           # XP, Profile, and Stats
│   ├── sessions.js     # Focus session lifecycle
│   ├── blocklist.js    # Domain management
│   ├── interceptions.js# Distraction logging
│   ├── squads.js       # Persistent squad management
│   └── parents.js      # Parent portal & child monitoring
├── .env                # Environment variables
├── package.json        # Dependencies and scripts
└── server.js           # Entry point (Unified HTTP + WS Server)
```

## 🛣️ API Endpoints (REST)

### 🔑 Authentication (`/api/auth`)
| Method | Endpoint    | Description             | Auth |
|--------|-------------|-------------------------|------|
| POST   | `/register` | Create a new account    | No   |
| POST   | `/login`    | Get JWT Token & User    | No   |

### 📈 User & XP (`/api/user`)
| Method | Endpoint      | Description                  | Auth |
|--------|---------------|------------------------------|------|
| GET    | `/profile`    | Fetch full user profile      | Yes  |
| GET    | `/stats`      | Fetch productivity stats     | Yes  |
| POST   | `/add-xp`     | Increment XP & Minutes (expects `{ xpDelta: 1 }`)| Yes  |
| POST   | `/deduct-xp`  | Deduct XP (Penalty logic)                        | Yes  |

### ⏱️ Focus Sessions (`/api/sessions`)
| Method | Endpoint    | Description                                      | Auth |
|--------|-------------|--------------------------------------------------|------|
| POST   | `/start`    | Start a new focus session                        | Yes  |
| PATCH  | `/:id/end`  | Complete session (Marks status & updates streak) | Yes  |
| PATCH  | `/:id/fail` | Mark session as failed                           | Yes  |
| GET    | `/history`  | Get last 20 focus sessions                       | Yes  |

### 👥 Squads (`/api/squads`)
| Method | Endpoint             | Description                                            | Auth |
|--------|----------------------|--------------------------------------------------------|------|
| POST   | `/create`            | Create a new persistent squad (returns 5-digit code)   | Yes  |
| POST   | `/join`              | Join squad via `{ joinCode }`                          | Yes  |
| GET    | `/:id/leaderboard`   | Get squad members sorted by focusXP                    | Yes  |
| PATCH  | `/live-status`       | Update user's persistent 'isLive' status               | Yes  |
| DELETE | `/leave`             | Leave current squad                                    | Yes  |

### 👨‍👩‍👧 Parental Oversight (`/api/parents`)
| Method | Endpoint             | Description                                            | Auth |
|--------|----------------------|--------------------------------------------------------|------|
| POST   | `/register`          | Create a parent account                                | No   |
| POST   | `/link-child`        | Link a student account via email                       | Parent|
| GET    | `/child-activity`    | View detailed child activity (counts & timestamps)     | Parent|

## 🔌 WebSocket (Squad Sync)
Connect via `ws://<host>` (or `wss://` in production).

| Action | Payload Example | Description |
|--------|-----------------|-------------|
| `host` | `{ "action": "host", "name": "User", "xp": 100 }` | Create a volatile room. Returns `roomId` (5-char). |
| `join` | `{ "action": "join", "roomId": "ABCDE", "name": "User" }` | Join an ephemeral room. |
| `update_state`| `{ "action": "update_state", "status": "focusing", "xp": 105 }` | Broadcast status/XP to room. |
| `leave`| `{ "action": "leave" }` | Leave the current room. |

---

## 🔒 Security & CORS
- **Stateless JWT**: Bearer token required for protected REST routes.
- **Dynamic CORS**: Automatically trusts `chrome-extension://` origins to allow any developer extension ID to connect.
- **Atomic XP**: Uses MongoDB `$inc` to ensure linear XP growth without race conditions.

---
Developed with ❤️ by the FocusForge Team.
