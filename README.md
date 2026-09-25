# Suraksha React frontend

This is a separate React application in `Suraksha/frontend`, alongside `Suraksha/backend`.

## Run it

For **Geofencing Demo Mode**, sign in and open **GPS simulator** with backend `ENABLE_DEMO_MODE=true`. This is separate from the in-memory Explore demo. See the [complete simulator guide](../backend/docs/geofencing-demo.md).

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

During `npm run dev`, Vite proxies `/api/*` to `http://127.0.0.1:5000/*`. Socket.IO connects directly to port 5000 on the browser's current hostname, avoiding proxy resets during frontend rebuilds. Cookies remain available because browser cookies are scoped by host, not port. To change the API target in PowerShell:

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

The animated bars indicate recording mode, not measured loudness. Transcripts come only from backend responses. The modal distinguishes GPS from approximate IP location, missing location, failed SMS submissions, and successful submissions (which do not prove delivery). Dismissing the result does not restart microphone recording; active SOS monitoring continues independently. Keep the page open and device awake; browsers may suspend recording in the background. Tests use mocked microphones and HTTP responses and never send a live SOS.

## Rescue coordination and monitored journeys

After distress detection, the microphone stops immediately and buffered audio is discarded, including when SMS submission fails. An active SOS also prevents restarting the microphone. Victim GPS updates run independently in the app provider every 15 seconds while signed in with an active session, across workspace navigation, until resolution/expiry or sign-out. Precise-location failures appear above the rescue status; keep the app open and the device awake.

New SMS alerts include private response links when the backend has a reachable `PUBLIC_BASE_URL`. The backend hosts the mobile contact page directly. Contacts can accept, decline, confirm arrival, and optionally share GPS without creating an account. The victim and Safety agent screens show contact status and fresh distances alongside nearby responders; changes produce sounded notifications. A decline never promises incoming help, and GPS proximity never confirms arrival. See `../backend/docs/sms-reply-troubleshooting.md` for setup and link access details.

All shared in-app notifications play a two-tone chime after browser audio is unlocked by a click/tap or key press. Responder status updates include fresh distance and announce changes across 1 km, 500 m, 250 m, 100 m and 50 m bands. Stale locations never announce a current distance. Trusted-contact acknowledgments also sound, but SMS replies do not provide live GPS or prove that the contact is travelling. Browser/device mute settings and background suspension still apply; these are in-app alerts, not closed-app push notifications.

The Respond to SOS view shows authenticated persistent requests and provides accept/decline, assignment details, estimated distance/ETA, explicit arrival/completion, and cancellation. Safety journey starts optional destination/time/route monitoring. Safety agent includes owner rescue progress and resolution. These features use the existing backend `/agent` APIs; see `../backend/docs/responder-geofencing.md`. Demo mode does not submit these operations. Responder and journey location sharing is explicit and tied to its screen. Victim location sharing for active SOS sessions runs automatically across screens every 15 seconds. API polling every ten seconds recovers missed socket events. Start the upgraded backend and its worker before testing these views.
