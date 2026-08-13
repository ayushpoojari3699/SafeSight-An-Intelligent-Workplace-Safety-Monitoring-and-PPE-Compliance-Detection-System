# 🦺 Safesight — AI-Powered Construction Safety Intelligence Platform

An end-to-end platform that detects whether construction workers are wearing proper **Personal Protective Equipment (PPE)** in images *and video*, answers natural-language safety questions via a Retrieval-Augmented Generation (RAG) assistant, and gives administrators a secure, role-based console to manage it all.

| | |
|---|---|
| **Detection Model** | YOLOv8m |
| **mAP50** | 0.841 |
| **mAP50-95** | 0.467 |
| **Inputs** | Images (batch) and video (`.mp4 .mov .avi .mkv .webm`) |
| **Backend** | FastAPI + MongoDB |
| **Frontend** | React 19 + Tailwind CSS |
| **AI Assistant** | LangGraph + FAISS + MiniLM + pluggable LLM (Groq by default) |
| **Auth** | JWT (PyJWT) + bcrypt, role-based (Admin / User) |
| **Status** | ✅ Image + video detection, RAG assistant, sites, notifications, auth & admin console complete |

---

## 📌 Overview

PPE categories detected:

- Helmet
- Gloves
- Vest
- Boots
- Goggles

The detection pipeline locates each PPE item, applies geometric plausibility rules before attaching it to a worker, tracks workers across video frames, applies rule-based violation checks, and stores every result in MongoDB against a named **site**. On top of that, an AI Assistant answers natural-language questions about inspection history and uploaded safety manuals using Retrieval-Augmented Generation — and everything sits behind a login with two distinct roles: a read-only **User** experience and a full-control **Admin** console.

> For the detailed record of what changed and why in the latest revision — detection accuracy fixes, the hosted chat model, the light theme — see [`CHANGES.md`](CHANGES.md).

---

## 🧑‍🤝‍🧑 Roles & Permissions

| Capability | User | Admin |
|---|:---:|:---:|
| Interactive Dashboard (read-only inspection history, filters, charts) | ✓ | ✓ |
| AI Assistant (chat over inspections + manuals) | ✓ | ✓ |
| Violation notifications (topbar bell, acknowledge) | ✓ | ✓ |
| Run PPE detection on images (Upload Center) | — | ✓ |
| Run PPE detection on video (Upload Center, live streaming results) | — | ✓ |
| Upload knowledge-base documents (PDF/DOCX/TXT) | — | ✓ |
| Manage / delete detections | — | ✓ |
| Manage / delete documents, rebuild knowledge base | — | ✓ |
| Analytics (compliance trend, violation breakdown) | — | ✓ |
| Manage construction sites (create / delete) | — | ✓ |
| User management (create, edit role, reset password, delete) | — | ✓ |
| Settings (change own password) | ✓ (self only) | ✓ |

Every admin-only route is enforced **server-side** via a FastAPI dependency (`require_admin`), not just hidden in the UI.

### Default accounts (seeded automatically on first backend startup)

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | admin |
| `user` | `user123` | user |

Usernames are matched case-insensitively and trimmed, so `Anisha` and `anisha` reach the same account. Change these passwords before any real deployment — see [Security Notes](#-security-notes).

A default site, **Construction Site A**, is also seeded on first startup so the Upload Center always has somewhere to assign detections.

---

## 🏗️ Architecture

```
CLIENT (React)
  Login → User Dashboard / AI Assistant   (all logged-in users)
        → Admin Console (Upload · Documents · Detections · Analytics · Sites · Users · Settings)
    ↓  JWT bearer token on every request
APPLICATION LAYER (FastAPI)
  auth.py               → JWT issue/verify, bcrypt hashing, role dependencies
  api.py                → REST routes (detect, detect-video, chat, documents,
                          detections, sites, notifications, users, analytics)
  ppe_geometry.py       → plausibility rules for PPE→worker attachment
  llm_provider.py       → chat model selection (groq / gemini / openai / ollama)
  langgraph_pipeline.py → intent routing for the RAG assistant
    ↓
DATA & INTELLIGENCE
  MongoDB            → users, detection_history, documents, sites
  YOLOv8m            → PPE object detection
  FAISS + MiniLM     → vector index over uploaded manuals/reports
  Hosted or local LLM → grounded answer generation
```

---

## 📂 Project Structure

```
PPE/
│── api.py                    # FastAPI app — all REST routes, video pipeline, main entry point
│── auth.py                   # JWT + bcrypt auth, role dependencies, default account seeding
│── database.py               # MongoDB connection + collections (users, detections, documents, sites)
│── requirements.txt          # Python backend dependencies
│── .env.example              # Template for local config (copy to .env)
│
│── detect.py                 # YOLO inference
│── ppe_geometry.py           # Plausibility rules — confidence, containment, body region, size
│── associate.py              # Maps PPE items to workers (via ppe_geometry)
│── violation_checker.py      # Rule-based violation engine + shared compliance formula
│── risk_engine.py            # Risk level / recommendation scoring
│
│── document_processor.py     # Extracts text from PDF/DOCX/TXT uploads
│── data_processing.py        # Chunks + prepares data for embedding
│── embedding.py              # Generates MiniLM embeddings
│── faiss_db.py               # Builds/queries the FAISS vector index
│── knowledge_base.py         # Rebuilds embeddings + FAISS index after upload/delete
│── llm_provider.py           # Chat model selection + lazy provider imports
│── langgraph_pipeline.py     # LangGraph workflow — intent routing for the AI Assistant
│── rag_pipeline.py           # Standalone RAG helper (ask_question)
│── report_generator.py / pdf_report_generator.py  # PDF inspection report generation
│
│── documents/                # Uploaded manuals/reports (source files)
│── uploads/                  # Uploaded input images
│── videos/                   # Uploaded input videos
│── outputs/                  # Annotated YOLO output images (incl. kept video frames)
│── reports/                  # Generated PDF reports
│── runs/                     # YOLO training/inference runs
│
│── app.py                    # Legacy Streamlit prototype (not part of the live API)
│
└── frontend/
    │── src/
    │   │── App.jsx                    # Routes + role-based route guards
    │   │── Dashboard.jsx              # Read-only interactive dashboard (all roles)
    │   │── index.css                  # Light-theme palette remap + base font size
    │   │── context/AuthContext.jsx    # Auth state, token storage, axios auth header
    │   │── components/ProtectedRoute.jsx
    │   │── components/WorkerComplianceTable.jsx   # Cumulative per-worker PPE checklist
    │   │── components/charts/         # ComplianceTrend · ViolationBar · SiteCompliance · WorkerSplitDonut
    │   │── layouts/AppShell.jsx       # Sidebar + topbar shell (incl. notification bell)
    │   │── lib/api.js                 # API base URL + shared helpers
    │   │── lib/chatHistory.js         # Per-user chat persistence (cleared on logout)
    │   │── pages/
    │   │   │── Login.jsx
    │   │   │── AIAssistant.jsx        # Chat UI (all roles)
    │   │   └── admin/
    │   │       │── AdminUploadCenter.jsx    # Run image + video detections, upload documents
    │   │       │── AdminDocuments.jsx       # Manage knowledge-base documents
    │   │       │── AdminDetections.jsx      # Manage inspection history
    │   │       │── AdminAnalytics.jsx       # Compliance trend + violation charts
    │   │       │── AdminSites.jsx           # Create / delete construction sites
    │   │       │── AdminUsers.jsx           # User management
    │   │       └── AdminSettings.jsx        # Change password + platform info
```

---

## ⚙️ How It Works

### PPE Detection Pipeline (images)

1. **Dataset & Training** — YOLOv8m trained on construction worker images with bounding-box PPE annotations (`Helmet`, `Gloves`, `Vest`, `Boots`, `Goggles`, `Person`), 20 epochs @ 640px, mAP50 0.841 / mAP50-95 0.467. Configured via `data.yaml`.
2. **Detection** (`detect.py`) — loads the trained model, returns bounding boxes for each person + PPE class.
3. **Plausibility filtering** (`ppe_geometry.py`) — before a PPE box may be attached to anyone it must clear four checks: a per-class confidence floor, ≥60% of the box inside the person box, the correct body region (helmets up top, boots down low), and a plausible size relative to the person. Boxes that fail are dropped rather than forced onto the nearest worker.
4. **Association** (`associate.py`) — matches surviving PPE items to the correct worker.
5. **Violation checking** (`violation_checker.py`) — flags missing items per worker and computes compliance as *items present / items required*, the single formula used on every screen. A worker counts as **Safe** only with all 5 items (`SAFE_MIN_ITEMS_PRESENT`).
6. **Storage** — the annotated image, per-worker breakdown, site name, and summary are saved to MongoDB (`detection_history`).

### Video Detection Pipeline

`POST /detect-video` runs that same pipeline over a video and **streams results back as newline-delimited JSON**, so the Upload Center shows frames as they are analysed instead of a blank spinner.

- Short videos are processed **frame by frame**. Longer ones are sampled evenly across the full duration (`MAX_VIDEO_FRAMES = 300`) so the whole video is represented, not just the opening seconds.
- When sampling, a small window of neighbouring frames is inspected and the **sharpest** one is kept (`BLUR_SEARCH_WINDOW`) — motion blur is a leading cause of missed PPE.
- **Worker tracking** uses position continuity rather than appearance: a person cannot teleport between adjacent frames. Appearance-based matching used to break the moment someone pulled on a hi-vis vest, splitting one worker into many.
- **Cumulative confirmation** — an item is only credited after 3 detections within any 5 consecutive sightings of that worker (`CUMULATIVE_MIN_IN_WINDOW` / `CUMULATIVE_WINDOW`), so genuine PPE confirms in ~3 frames while isolated misfires never stick.
- Results are cumulative across the whole video: a worker who dons a vest at 0.7s and a helmet at 3s shows both. Up to `MAX_VIDEO_RESULT_FRAMES` (24) annotated frames are persisted, prioritising frames with violations.

### RAG AI Assistant

1. Admin uploads a PDF/DOCX/TXT manual via the Upload Center → `document_processor.py` extracts text.
2. `data_processing.py` chunks the text; `embedding.py` encodes it with `all-MiniLM-L6-v2`.
3. `faiss_db.py` rebuilds the FAISS index (`knowledge_base.py` orchestrates this on every upload/delete).
4. A user or admin asks a question → `langgraph_pipeline.py` classifies intent, retrieves relevant chunks/inspection records via FAISS, and the configured chat model (`llm_provider.py`) drafts a grounded, source-cited answer.
5. Chat history persists per username across navigation and reloads, and is cleared on logout (including expiry-triggered logout).

Retrieval and embeddings always run **locally**; only answer generation is hosted when a hosted provider is selected.

### Sites & Notifications

- **Sites** are a first-class entity (`sites` collection). Detections are assigned a site at upload time, which drives the site filter on the dashboard and the compliance-by-site chart.
- **Notifications** surface recent inspections that flagged at least one violation and haven't been acknowledged. The topbar bell shows the unread count; items can be acknowledged individually or all at once.

### Auth & Access Control

1. `POST /auth/login` verifies the bcrypt-hashed password and issues a signed JWT (8-hour expiry) containing the username and role.
2. The frontend stores the token and attaches it as a `Bearer` header on every request (`AuthContext.jsx`).
3. Every route requires `get_current_user`; admin-only routes additionally require `require_admin` — both are FastAPI dependencies defined in `auth.py`.
4. Default `admin`/`user` accounts are seeded automatically the first time the `users` collection is empty.
5. Login failures report what actually happened (bad credentials vs. backend unreachable vs. server error) rather than a single generic message.

---

## 🔌 API Reference

All routes except `/`, `/health`, and `/auth/login` require an `Authorization: Bearer <token>` header. Admin-only routes are marked 🔒.

| Method & Path | Purpose |
|---|---|
| `GET /` | Service banner (status, version) |
| `GET /health` | Health + the LLM provider/model actually running |
| `POST /auth/login` | Log in, returns JWT + role |
| `GET /auth/me` | Current user info |
| `POST /auth/change-password` | Self-service password change |
| `GET /manuals` | List indexed manual filenames |
| `GET /sites` | List construction sites |
| `POST /sites` 🔒 | Create a site |
| `DELETE /sites/{site_id}` 🔒 | Delete a site |
| `POST /detect` 🔒 | Upload images (+ `site_name`), run YOLOv8 PPE detection |
| `POST /detect-video` 🔒 | Upload a video (+ `site_name`), streams per-frame NDJSON results |
| `GET /detections` | List inspection history (summaries) |
| `GET /detections/{id}` | Full detail for one inspection |
| `DELETE /detections/{id}` 🔒 | Delete an inspection record |
| `GET /download-report/{id}` | Download a PDF inspection report |
| `GET /notifications` | Unacknowledged violation alerts + unread count |
| `POST /notifications/{id}/ack` | Acknowledge one alert |
| `POST /notifications/read-all` | Acknowledge all alerts |
| `POST /upload-document` 🔒 | Upload a manual/document, rebuild knowledge base |
| `GET /documents` 🔒 | List documents with metadata |
| `DELETE /documents/{filename}` 🔒 | Delete a document, rebuild knowledge base |
| `POST /rebuild-knowledge-base` 🔒 | Manually rebuild embeddings + FAISS index |
| `POST /chat` | Ask the AI Assistant a question (RAG) |
| `GET /analytics` 🔒 | Compliance trend + violation breakdown |
| `GET /users` 🔒 | List user accounts |
| `POST /users` 🔒 | Create a user account |
| `PUT /users/{username}` 🔒 | Update role and/or reset password |
| `DELETE /users/{username}` 🔒 | Delete a user account |

Static mounts: `/uploads`, `/outputs`, `/documents`, `/videos`.

Interactive Swagger docs available at `http://127.0.0.1:8000/docs` while the backend is running.

---

## 🚀 Setup & Run

### Prerequisites
- Python 3.10+
- Node.js + npm
- MongoDB running locally (`mongodb://localhost:27017`)
- A free [Groq](https://console.groq.com) API key (recommended), **or** [Ollama](https://ollama.com) for fully local inference: `ollama pull llama3.1`

### Backend
```bash
pip install -r requirements.txt
copy .env.example .env      # Windows  (macOS/Linux: cp .env.example .env)
```
Open `.env` and set `GROQ_API_KEY=your-key`.

### Frontend
```bash
cd frontend
npm install
```

### Run the project
```bash
run_project.bat
```
This starts the FastAPI backend (`uvicorn api:app --reload`, port 8000) and the Vite dev server (port 5173), then opens the app in your browser. Make sure MongoDB is already running — the batch script does not start it (nor Ollama, if you're using local inference).

Log in at `http://localhost:5173/login` with one of the [default accounts](#default-accounts-seeded-automatically-on-first-backend-startup) above.

> The chat model is chosen **once at startup**. After editing `.env`, close the backend window and start it again — `--reload` is not enough.

---

## 🤖 Chat model configuration

The assistant uses **Groq** out of the box — answers land in roughly 1–2s, versus 15–30s for local inference on a typical laptop. Retrieval (FAISS + MiniLM embeddings) still runs locally; only answer generation is hosted.

**No key yet?** The backend logs a warning and falls back to local Ollama automatically, so the app still runs — just slower. Without Ollama either, detection, dashboard and reports all still work; only the AI Assistant is affected, and it names what's missing. `/health` and Admin → Settings always show which provider and model are actually live.

**To force local/offline mode**, set `SAFESIGHT_LLM_PROVIDER=ollama` in `.env`.

| Variable | Default | What it does |
|---|---|---|
| `SAFESIGHT_LLM_PROVIDER` | `groq` | Where the model runs: `groq`, `gemini`, `openai`, or `ollama` (local). |
| `SAFESIGHT_LLM_MODEL` | per provider | Which model to use. Smaller = faster locally. |
| `SAFESIGHT_LLM_NUM_CTX` | `4096` | Context window size. Lowering it (e.g. `2048`) speeds up prompt processing. **Ollama only.** |
| `SAFESIGHT_LLM_NUM_PREDICT` | `800` | Max tokens generated per answer — caps worst-case response time on any provider. |
| `SAFESIGHT_LLM_TEMPERATURE` | `0` | Leave at 0 unless you want varied phrasing; this is a compliance tool. |
| `SAFESIGHT_SECRET_KEY` | dev fallback | Signs login tokens. Set a real value before any real deployment. |

| Provider | Package | API key variable | Default model | Notes |
|---|---|---|---|---|
| `groq` | `langchain-groq` | `GROQ_API_KEY` | `llama-3.3-70b-versatile` | Fastest by a wide margin; free tier, no card required. |
| `gemini` | `langchain-google-genai` | `GOOGLE_API_KEY` | `gemini-2.0-flash` | Generous free tier, very large context window. |
| `openai` | `langchain-openai` | `OPENAI_API_KEY` | `gpt-4o-mini` | Best instruction-following; paid per token. |
| `ollama` | `langchain-ollama` | — | `llama3.1:latest` | Fully local and offline; needs a decent GPU to feel snappy. |

Provider packages are imported lazily, so nothing is loaded for a provider you don't select. Two things to weigh before using a hosted provider: inspection summaries and manual excerpts get sent to a third party (text only — no site images), and the assistant stops working without internet.

**Running locally and it feels slow?** Response time depends entirely on *your* CPU/GPU via Ollama, not the app. `llama3.1` (8B) needs several GB of VRAM to feel snappy. Switch to a lighter model — no code changes needed:

```bash
ollama pull llama3.2:3b
```

```powershell
# Windows (PowerShell)
$env:SAFESIGHT_LLM_MODEL = "llama3.2:3b"
uvicorn api:app --reload
```

```bash
# macOS/Linux
SAFESIGHT_LLM_MODEL=llama3.2:3b uvicorn api:app --reload
```

**Model names change often.** If you get a "model not found" error, check the provider's current model list and set `SAFESIGHT_LLM_MODEL` rather than editing code.

---

## 🎛️ Where to tune things

| What | File | Constant |
|---|---|---|
| Safe threshold (items required) | `violation_checker.py` | `SAFE_MIN_ITEMS_PRESENT` |
| Detection strictness | `ppe_geometry.py` | `MIN_CONFIDENCE`, `PPE_ITEM_RULES` |
| Cumulative confirmation | `api.py` | `CUMULATIVE_WINDOW`, `CUMULATIVE_MIN_IN_WINDOW` |
| Tracking sensitivity | `api.py` | `STRONG_IOU_CONTINUITY` |
| Video frame caps / blur search | `api.py` | `MAX_VIDEO_FRAMES`, `MAX_VIDEO_RESULT_FRAMES`, `BLUR_SEARCH_WINDOW` |
| Model / provider | `.env` | `SAFESIGHT_LLM_PROVIDER`, `SAFESIGHT_LLM_MODEL` |
| Answer length cap | `.env` | `SAFESIGHT_LLM_NUM_PREDICT` |
| Theme + font size | `frontend/src/index.css` | light-theme block, `html { font-size }` |

---

## 🩺 Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `/health` says `ollama` when you set Groq | key or package missing, or backend not restarted | read the startup banner — it names the cause |
| "Falling back to local Ollama" | no `GROQ_API_KEY`, or `langchain-groq` not installed | `pip install -r requirements.txt`, check `.env` |
| Chat: "rate limit" | Groq free tier is ~30 requests/min | wait a minute; it resets |
| Chat: "model not found" | provider renamed the model | set `SAFESIGHT_LLM_MODEL` to a current one |
| Chat fails with a CUDA / `llama-server` crash | GPU driver issue in the local Ollama install | restart Ollama, update drivers, or set `OLLAMA_LLM_LIBRARY=cpu` before starting it. The backend retries once automatically. |
| Login fails with correct password | old build, or backend down | the error message now distinguishes the two |
| Old inspections show old numbers | summaries are stored at detection time | re-run those images/videos |
| Assistant quotes stale compliance figures | indexed text predates the shared formula | rebuild the knowledge base from Admin → Documents |

---

## ✅ Current Status

**Completed**
- [x] Dataset collection & label cleaning
- [x] YOLOv8 model training
- [x] Detection → geometry filtering → association → violation-checking pipeline
- [x] Video detection with worker tracking, cumulative confirmation, and streamed live results
- [x] MongoDB-backed detection history
- [x] Construction sites as a first-class entity + site-based filtering and charts
- [x] Violation notifications with acknowledgement
- [x] RAG AI Assistant (LangGraph + FAISS + MiniLM)
- [x] Pluggable chat model (Groq / Gemini / OpenAI / Ollama) with automatic local fallback
- [x] Persistent per-user chat history
- [x] Knowledge-base document upload/management
- [x] JWT + bcrypt authentication with case-insensitive usernames
- [x] Role-based access control (User / Admin)
- [x] Admin console (Upload Center, Documents, Detections, Analytics, Sites, Users, Settings)
- [x] Interactive read-only dashboard with filters, sorting, pagination, and charts
- [x] Light theme across all pages
- [x] PDF report generation & authenticated export

**Upcoming**
- [ ] Server-side pagination for large datasets
- [ ] Admin action audit logging
- [ ] Streaming AI Assistant responses
- [ ] Hardened production auth (env-based secrets, rate limiting, forced first-login reset)
- [ ] Live camera feed detection (beyond uploaded images/video)
- [ ] Pose estimation to distinguish *held* PPE from *worn* PPE
- [ ] Cloud/container deployment
- [ ] Employee identity recognition (FaceNet)

---

## ⚠️ Known Limitations

- A vest **held up** in front of the body still registers as worn — the box sits inside the person at torso height at a plausible size, so bounding-box geometry alone can't separate "held" from "worn".
- With Safe requiring all five items, the compliance figure is bounded by detection recall. Goggles and gloves are the weakest classes, so a fully-equipped worker can read Unsafe on frames where goggles aren't picked up. If too much comes back Unsafe, adjust `MIN_CONFIDENCE` rather than lowering the Safe threshold.
- Inspections already saved keep the numbers they were saved with; the dashboard shows old figures until they're re-processed.
- The tracking rule could in principle merge two people whose boxes heavily overlap in a crowded frame. Matches are committed globally best-first so a genuine appearance match outranks it, but that's the thing to revisit if two workers ever collapse into one.

---

## 🔒 Security Notes

This project ships with development-friendly defaults that should be changed before any real-world use:

- `auth.py` falls back to a hardcoded `SAFESIGHT_SECRET_KEY` if the environment variable isn't set — always set a real secret in `.env` or the environment.
- The seeded `admin`/`user` passwords are intentionally simple — change them immediately via the Settings page or the Users admin panel.
- CORS is currently wide open (`allow_origins=["*"]`) for local development — restrict this before deploying publicly.
- `.env` holds your API key and is gitignored. **`.env.example` is committed — make sure no real key is left in it.** Zipping the project folder ignores `.gitignore` entirely, so a zip ships your `.env` too.
