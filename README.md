# 🛡️ FocusForge Backend (Chrome Extension Edition)

FocusForge is a high-performance productivity suite backend refactored to power a gamified **Chrome Extension**. It handles secure authentication, real-time focus sessions, site blocking logic, and social squad leaderboards.

## 🚀 Features

- **Gamified Productivity**: Track focus sessions with unified **Strict Delta XP** (per-minute increments) and dynamic leveling.
- **Delta-Based Synchronization**: Prevents exponential XP inflation by using atomic `$inc` updates for both XP and focus minutes every 60 seconds.
- **Chrome Extension Support**: CORS-optimized for `chrome-extension://` origins.
- **Site Blocking & Mindfulness**: Manage custom blocklists and log mindfulness interception events.
- **Social Squads**: Create or join squads with live focus status and competitive leaderboards.
- **Digital Wellbeing Stats**: Aggregated data on distraction patterns for AI-powered feedback.
- **Robust Security**: JWT-based stateless authentication with Bcrypt password hashing.

## 🛠️ Tech Stack

- **Runtime**: [Node.js](https://nodejs.org/)
- **Framework**: [Express.js](https://expressjs.com/)
- **Database**: [MongoDB Atlas](https://www.mongodb.com/atlas)
- **ORM**: [Mongoose](https://mongoosejs.com/)
- **Security**: JWT, Bcrypt, CORS
- **Environment**: Dotenv

## 📂 Project Structure

```text
FocusForge-Backend/
├── middleware/         # Custom middlewares (Auth)
├── models/             # Mongoose schemas (User, Session, Squad, Blocklist, etc.)
├── routes/             # API Route handlers (Auth, XP, Sessions, Squads, etc.)
├── .env                # Environment variables (Local only)
├── package.json        # Dependencies and scripts
└── server.js           # Application entry point & configuration
```

## 🛣️ API Endpoints

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

### 🚫 Blocklist (`/api/blocklist`)
| Method | Endpoint  | Description                              | Auth |
|--------|-----------|------------------------------------------|------|
| GET    | `/`       | Fetch the user's blocklist               | Yes  |
| PUT    | `/`       | Replace entire blocklist array           | Yes  |
| POST   | `/add`    | Append a domain to the blocklist         | Yes  |
| DELETE | `/remove` | Remove a domain from the blocklist       | Yes  |

### 🛡️ Interceptions (`/api/interceptions`)
| Method | Endpoint  | Description                                      | Auth |
|--------|-----------|--------------------------------------------------|------|
| POST   | `/log`    | Log a blocked site visit                         | Yes  |
| GET    | `/recent` | Last 10 interception logs                        | Yes  |
| GET    | `/context`| Aggregated distraction context for AI            | Yes  |

### 👥 Squads (`/api/squads`)
| Method | Endpoint             | Description                                            | Auth |
|--------|----------------------|--------------------------------------------------------|------|
| POST   | `/create`            | Create a new productivity squad                        | Yes  |
| POST   | `/join/:squadId`     | Join an existing squad                                 | Yes  |
| GET    | `/:id/leaderboard`   | Get squad members sorted by focusXP                    | Yes  |
| PATCH  | `/live-status`       | Update user's 'isLive' focus status                    | Yes  |

---

## 🔒 Security
- **Stateless JWT**: Bearer token authentication required for all protected routes.
- **CORS Extension Policy**: Explicitly allows requests from Chrome Extension IDs.
- **Atomic Operations**: Uses `$inc` and `$set` to prevent race conditions in XP/Stat updates.

---
Developed with ❤️ by the FocusForge Team.
