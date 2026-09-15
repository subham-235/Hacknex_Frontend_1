# Suraksha React frontend

This is a separate React application in `Suraksha/frontend`, alongside `Suraksha/backend`.

## Run it

Open a terminal in `frontend`:

```powershell
npm install
npm run dev
```

Open **http://localhost:5173**. Node 22.13 or newer is required. Demo mode is available immediately without a database or API keys. Its sample contacts, history and agent actions live only in memory; refreshing resets them. Demo SOS does not upload or analyze audio, send SMS, or create a backend session. The map uses online OpenStreetMap tiles.

For live use, start these in two separate terminals inside `backend`:

```powershell
npm start
```

```powershell
npm run agent:worker
```

The backend must successfully connect to MongoDB and Redis. Choose **Sign in** in the frontend, then register or log in. The frontend cannot repair a blocked database connection.

## Screens

- **Overview:** counts, safety checklist, recent activity, and shortcuts.
- **Emergency SOS:** activate Suraksha Mode for four-second WebM recordings, backend transcripts, and automatic distress alerts. Includes a 36-bar visual indicator and animated SOS result modal. Chrome/Edge with microphone access on localhost or HTTPS is required. Deactivating or leaving this screen releases the microphone. Demo mode never uploads audio or sends SMS.
- **Trusted contacts:** create, pause/activate, and delete contacts. The existing backend sends SMS, so the interface exposes SMS only.
- **Community:** incident map and report form; optional location sharing while this screen stays open. Updates occur every 30 seconds. Leaving the screen attempts to deactivate sharing. If the network fails or the tab closes abruptly, the last backend location can persist for its 10-minute expiry period.
- **Alert history:** recent entries, search, transcript and location details, deletion. Deleting history does not resolve its agent session.
- **Safety agent:** sessions, proposed actions, explicit SMS follow-up approval, rejection, delivery status, activity, and session resolution.
- **Settings:** backend HTTP check, account, permissions guidance, and workflow explanation.

## How the agent workflow appears here

1. Activate Suraksha Mode to authorize continuous audio uploads and automatic initial SOS alerts. Device location is attempted first, then approximate IP location; unavailable location does not block audio.
2. The backend analyzes the audio using Gemini. If it detects distress, it attempts initial SMS alerts through Twilio and may create an agent session.
3. The separate agent worker uses MongoDB session records and the Redis queue to check delivery, replies and follow-up needs.
4. In review mode, suggested follow-ups appear under **Safety agent**. Approving one authorizes the worker to attempt another SMS; rejecting prevents that proposed action.
5. Twilio callbacks update delivery/reply information. Socket.IO tells the frontend to refresh session data. You can also use Refresh manually.
6. Choose **I'm safe - resolve session** to stop future follow-ups. Already-submitted messages cannot be recalled.

Submission, delivery and acknowledgment are different states. A delivered SMS does not prove someone is helping. Network errors during an SOS can leave the outcome uncertain: check history before trying again. The frontend never automatically retries SOS sending.

## Configuration and deployment

During `npm run dev`, Vite proxies `/api/*` to `http://127.0.0.1:5000/*` and `/socket.io` to the same backend. This keeps cookies on one browser origin. To change the local target in PowerShell:

```powershell
$env:BACKEND_URL = 'http://127.0.0.1:5000'
npm run dev
```

`.env.example` contains only the public client setting `VITE_API_URL`. Copy it to `.env` only if needed. Never copy backend secrets into frontend files: all `VITE_` variables are public browser code.

The production build uses React, TypeScript, Vinext/Vite and the Sites runtime. A development proxy is not included in production. For a hosted live frontend, configure an HTTPS backend with appropriate credentialed CORS/cookie settings and set `VITE_API_URL` to that public origin at build time, or provide a same-origin reverse proxy for `/api` and `/socket.io`. A private preview without that configuration supports demo exploration; it cannot access your computer's local backend.

## Checks

```powershell
npm test
npm run typecheck
npm run build
```

Tests cover cookie-bearing API calls, multipart uploads, failure outcomes, absence of automatic retries, timeouts, coordinate validation and safe map links. These are offline checks, not proof of working Gemini/Twilio credentials or live database connectivity. No live SOS was sent during implementation.

## Source layout

`app/page.tsx` contains navigation and the workspace shell. `components/` contains the individual feature screens and shared state. `lib/api.mjs` is the HTTP client; `lib/models.ts` holds types and clearly labelled demo fixtures. `app/globals.css` contains the responsive theme. Navigation uses URL hashes so sections can be bookmarked.

The backend session-check handler was also corrected to read `req.user`, allowing authenticated refreshes to work once the backend is online.

## Voice monitoring implementation

The standalone JavaScript hooks are `hooks/useAudioRecorder.js` and `hooks/useSurakshaMode.js`; the JSX components are `components/MicVisualizer.jsx`, `components/LiveTranscript.jsx`, `components/AlertModal.jsx`, and `components/VoicePanel.jsx`. They use native browser APIs and inline styles, with no speech recognition or audio packages. `sos-panel.tsx` only connects the screen to the existing account/demo state.

Each four-second segment is finalized before upload so it contains a complete WebM container. The 500-byte filter removes tiny payloads, not acoustic silence. Busy requests cause new segments to be skipped rather than queued. Requests include cookies and `audio`, `lat`, `lon`, plus the legacy backend `location` field; missing location is explicitly marked unavailable. Zero coordinates are preserved. Upload errors are console-only and the next new segment can try again. Stopping cancels local requests but cannot recall an SMS already submitted by the backend. The backend's existing policy controls repeated distress alerts; this screen does not add a cooldown.

The animated bars indicate recording mode, not measured loudness. Transcripts come only from backend responses. The modal distinguishes GPS from approximate IP location, missing location, failed SMS submissions, and successful submissions (which do not prove delivery). Dismiss keeps monitoring active. Keep the page open and device awake; browsers may suspend recording in the background. Tests use mocked microphones and HTTP responses and never send a live SOS.
