# LogiTrack — Professional Shipment Tracking Platform

> Full-stack logistics dashboard for real-time shipment tracking, fleet management, and AI-powered analytics.

---

## Quick Start

```bash
# One command to run everything
python start.py
```

This single command will:
1. ✅ Check and install Python dependencies
2. ✅ Verify Node.js and install frontend packages
3. ✅ Seed the database with demo shipments (first run)
4. ✅ Start the FastAPI backend on **port 8001**
5. ✅ Start the React frontend on **port 5173**

Open **http://localhost:5173** in your browser.

---

## Architecture

```
LogiTrack/
├── start.py                  ← Unified launcher (run this!)
├── .env                      ← All configuration (API keys, DB)
├── .gitignore
│
├── backend/                  ← FastAPI + SQLModel
│   ├── app/
│   │   ├── api/v1/endpoints/ ← REST endpoints
│   │   ├── core/config.py    ← Settings (reads root .env)
│   │   ├── db/session.py     ← Database engine
│   │   ├── models/           ← SQLModel data models
│   │   └── services/         ← Carrier API integrations
│   ├── seed.py               ← Demo data seeder
│   ├── run.py                ← Backend entry point
│   └── requirements.txt
│
└── frontend/                 ← React + Vite
    ├── src/
    │   ├── App.jsx           ← Dashboard UI
    │   ├── App.css           ← Design system
    │   ├── api.js            ← Backend API client
    │   └── main.jsx          ← React entry
    ├── index.html
    ├── vite.config.js
    └── package.json
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/shipments/` | List all shipments |
| `GET` | `/api/v1/shipments/stats` | Dashboard stat counts |
| `GET` | `/api/v1/shipments/{id}` | Get single shipment |
| `POST` | `/api/v1/shipments/track/{tracking_number}` | Track via FedEx API |
| `DELETE` | `/api/v1/shipments/{id}` | Remove a shipment |
| `GET` | `/docs` | Interactive API documentation |

## Configuration

All settings are in the root **`.env`** file:

```env
# FedEx API (Sandbox)
FEDEX_CLIENT_ID=your_client_id
FEDEX_CLIENT_SECRET=your_secret
FEDEX_URL=https://apis-sandbox.fedex.com

# Google Gemini AI (optional — enables AI chat)
GEMINI_API_KEY=your_gemini_key
```

## Features

- **Real-time Dashboard** — Stat cards, filterable shipment table, detail panel
- **Carrier Integration** — FedEx API tracking (UPS/DHL architecture ready)
- **AI Assistant** — Gemini-powered chat for shipment queries and email drafts
- **Dark Mode** — Full light/dark theme toggle
- **Responsive** — Works on desktop and mobile screens
- **Demo Data** — Auto-seeded on first launch for immediate demonstration

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite 5, Lucide Icons |
| Backend | FastAPI, SQLModel, Pydantic |
| Database | SQLite (dev) / PostgreSQL-ready |
| AI | Google Gemini API |
| Carriers | FedEx REST API |

## CLI Options

```bash
python start.py              # Start everything
python start.py --seed       # Force re-seed demo data
python start.py --backend    # Backend only
python start.py --frontend   # Frontend only
```

## License

MIT
