# Safesight — Change Report

**In one line:** PPE detection was silently miscounting workers and inventing gear, several screens contradicted each other, and the AI Assistant took 15–30s per answer. All three are fixed. You need to run three setup commands.

---

## 1. Setup — do this first

```powershell
cd A:\PPE
pip install -r requirements.txt
copy .env.example .env
```

Get a free API key at [console.groq.com](https://console.groq.com) (no credit card), open `.env`, and set `GROQ_API_KEY=your-key`. Then **restart the backend fully** — closing the window and starting again, not just `--reload`, because the model is chosen once at startup.

**If you skip this, nothing breaks.** Without a key the backend prints a warning and falls back to local Ollama exactly as before. Without Ollama either, detection, dashboard and reports still work — only the AI Assistant is affected, and it names what's missing.

**One-time, recommended:** rebuild the knowledge base from Admin → Documents. Old inspections have an outdated compliance figure baked into their indexed text (see §5).

### Confirm it's working

| Check | Where | Expect |
|---|---|---|
| Model in use | backend startup log | `LLM: llama-3.3-70b-versatile via groq` |
| Model in use | http://127.0.0.1:8000/health | `"llm_provider":"groq"`, `"llm_is_local":false` |
| Answer speed | AI Assistant | 1–2s, not 15–30s |
| Tracking | upload a video | **one** worker row, not one per few frames |
| Compliance | assistant report cards | graded values (60%, 80%), not only 0/100% |

---

## 2. Detection accuracy — the main work

Four separate problems were making results untrustworthy.

**Workers were being split into many people.** Track identity was matched on a colour-histogram signature. Putting PPE *on* is exactly what destroys that signature — pulling a hi-vis vest over a shirt rewrites most of the histogram in one frame, so the person got a new track ID and everything detected earlier was stranded on the old one. Identity now relies on position continuity: a person can't teleport between adjacent frames, and if there's one person on screen and one recent track, they're the same person.

**PPE was attributed to people wearing none of it.** Any PPE box whose centre landed anywhere inside a person's rectangle counted — including a helmet on a bench or boots detected at head height. New `ppe_geometry.py` applies four checks: per-class confidence floor, ≥60% of the box inside the person, correct body region, plausible size. Unmatched boxes are dropped rather than forced onto the nearest person.

**Sporadic misfires stuck forever.** An item needed just 2 detections anywhere in a track. Over 300 frames, a class misfiring on 0.7% of frames cleared that and stayed ticked — how a bare-handed worker got gloves. Now requires 3 detections within any 5 consecutive frames, so genuine PPE confirms in ~3 frames while isolated blips never do.

**Live view invented PPE.** It showed anything seen in the last 5 frames, so one stray box stayed lit for five. Now requires the current frame, or 2 of the last 5.

**Safe now requires all 5 items** (was 3 of 5).

| Scenario | Before | After |
|---|---|---|
| One worker donning helmet → vest → gloves | 10 "workers" | 1 worker |
| Vest held up in front of body | counted as worn | rejected (too wide) |
| Helmet on the ground nearby | counted as worn | rejected (outside person) |
| Gloves misfiring in 2 of 300 frames | ticked permanently | rejected |
| Worker missing only goggles | 0% compliant | 80% compliant |

---

## 3. Numbers that contradicted each other

The summary cards and the worker checklist were computed by different code with different rules, so the same screen could show three ticked items *and* count that worker as a violation. The cards looked only at the last few frames and ignored the Safe/Unsafe threshold entirely. Both now run through one function.

The video results table is cumulative across the whole video rather than per-frame — a worker who puts on a vest at 0.7s and a helmet at 3s shows both, and scrubbing doesn't wipe items off. Hovering a tick shows when it was confirmed and in how many frames.

The inspection drawer showed whole-video counts above a single frame's table with nothing distinguishing them. Both are now labelled, and frames are listed by timestamp instead of a long identical filename.

---

## 4. AI Assistant

The model is configurable and hosted by default (`llm_provider.py`). `SAFESIGHT_LLM_PROVIDER` accepts `groq` (default), `gemini`, `openai` or `ollama`; provider packages are imported lazily so nothing loads for one you don't use. Answers drop from 15–30s to 1–2s.

Two trade-offs to state plainly: inspection summaries and manual excerpts are sent to a third party (text only, no site images), and the assistant needs internet.

`rag_pipeline.py` had its own hardcoded `ChatOllama("llama3.1")`, and `/health` returned `"llama3.1"` as a literal string — so changing the model updated one path and the UI kept claiming Llama 3.1 regardless. All surfaces now report what's actually running.

Chat history persists across navigation and reloads, stored per username, cleared on logout (including expiry-triggered logout).

---

## 5. Compliance showed only 0% or 100%

`data_processing.py` computed compliance as `safe_workers / total_workers`. With one worker per image that's binary — someone missing only their goggles read as "0% compliant" while wearing four of five items. It now uses the shared "% of required items present" formula.

The existing search index was built with the old formula and stores no worker data, so the assistant's report cards heal on read by fetching workers from MongoDB and recomputing — **no rebuild needed for the cards**. The embedded *text* still carries old figures though, so the assistant could quote them in prose until the knowledge base is rebuilt.

---

## 6. Login

Two bugs could reject valid credentials: the login call was hardcoded to `127.0.0.1` (so it broke from any other machine while the rest of the app worked), and usernames were matched case-sensitively, so an account created as "Anisha" couldn't log in as "anisha".

Separately, *every* failure said "check your credentials" — including a backend that wasn't running or a 500. Each now reports what actually happened.

---

## 7. Interface

Light theme across all 15 pages, implemented as a palette remap in `index.css` rather than rewriting hundreds of class names — delete that block to revert. Base font 16px → 18px; everything is rem-based so spacing scales with it.

New dashboard charts: a trend chart that switches between compliance / violations / workers and supports dragging to filter a date range, compliance-by-site (worst first, click to filter), a safe/unsafe donut, and toasts when new inspections arrive.

---

## 8. Where to tune things

| What | File | Constant |
|---|---|---|
| Safe threshold | `violation_checker.py` | `SAFE_MIN_ITEMS_PRESENT` |
| Detection strictness | `ppe_geometry.py` | `MIN_CONFIDENCE`, `PPE_ITEM_RULES` |
| Cumulative confirmation | `api.py` | `CUMULATIVE_WINDOW`, `CUMULATIVE_MIN_IN_WINDOW` |
| Tracking sensitivity | `api.py` | `STRONG_IOU_CONTINUITY` |
| Model / provider | `.env` | `SAFESIGHT_LLM_PROVIDER`, `SAFESIGHT_LLM_MODEL` |
| Answer length cap | `.env` | `SAFESIGHT_LLM_NUM_PREDICT` |
| Theme + font size | `index.css` | light-theme block, `html { font-size }` |

---

## 9. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `/health` says `ollama` | key or package missing, or backend not restarted | read the startup banner — it names the cause |
| "Falling back to local Ollama" | no `GROQ_API_KEY`, or `langchain-groq` not installed | `pip install -r requirements.txt`, check `.env` |
| Chat: "rate limit" | free tier is ~30 requests/min | wait a minute; it resets |
| Chat: "model not found" | provider renamed the model | set `SAFESIGHT_LLM_MODEL` to a current one |
| Login fails with correct password | old build, or backend down | error message now distinguishes the two |
| Old inspections show old numbers | summaries are stored at detection time | re-run those images/videos |

---

## 10. Files changed

**Backend:** `api.py`, `associate.py`, `violation_checker.py`, `data_processing.py`, `langgraph_pipeline.py`, `rag_pipeline.py`, `auth.py`, `requirements.txt`, `README.md`, `.gitignore`
**New:** `ppe_geometry.py` (plausibility rules), `llm_provider.py` (model selection), `.env.example`

**Frontend:** `Dashboard.jsx`, `index.css`, `pages/AIAssistant.jsx`, `pages/Login.jsx`, `pages/admin/AdminUploadCenter.jsx`, `pages/admin/AdminSettings.jsx`, `layouts/AppShell.jsx`, `context/AuthContext.jsx`, `components/charts/ComplianceTrendChart.jsx`
**New:** `components/WorkerComplianceTable.jsx`, `components/charts/SiteComplianceChart.jsx`, `components/charts/WorkerSplitDonut.jsx`, `lib/chatHistory.js`

---

## 11. Known limitations — read before demoing

A vest **held up** in front of the body still registers as worn. The box sits inside the person at torso height and is a plausible size, so bounding-box geometry can't separate "held" from "worn" — that needs pose estimation or training data for carried PPE.

With Safe requiring all five items, the compliance figure is bounded by detection recall. Goggles and gloves are the weakest classes, so a fully-equipped worker can read Unsafe on frames where goggles aren't picked up. If too much comes back Unsafe, adjust `MIN_CONFIDENCE` rather than lowering the threshold.

Inspections already saved keep the numbers they were saved with; the dashboard shows old figures until they're re-processed.

The tracking rule could in principle merge two people whose boxes heavily overlap in a crowded frame. Matches are committed globally best-first so a genuine appearance match outranks it, but that's the thing to revisit if two workers ever collapse into one.

**Before sharing this project:** `.env` holds the API key and is gitignored, but `.env.example` is committed — make sure the key isn't in it. A zip ignores `.gitignore` entirely, so zipping the folder ships `.env` too.
