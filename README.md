# CrisisBridge

AI-powered emergency dispatch triage platform built as a Progressive Web App. Victims report emergencies via voice or text, and an AI pipeline triages, transcribes, and summarizes incidents in real time for dispatchers.

## Features

### Victim PWA (Mobile-First)
- **Voice SOS** -- tap to record, describe your emergency, and send
- **Silent SOS** -- send your GPS location with an optional typed message when you can't speak
- **AI Follow-Up Questions** -- the AI asks targeted follow-up questions via text-to-speech to gather critical info for first responders
- **Live Feed** -- view all active emergencies in your area with severity badges and map previews
- **WebRTC Calling** -- receive live audio calls from dispatchers directly in the browser
- **Push Notifications** -- get browser notifications when new emergencies are reported
- **Offline Support** -- service worker with offline fallback via Serwist

### Dispatcher Dashboard (Desktop)
- **Real-Time Map** -- Leaflet map with severity-colored markers that update instantly via Supabase Realtime
- **Priority Queue** -- sorted sidebar of active emergencies with severity badges
- **Crisis Detail Panel** -- full AI summary, complete conversation transcript, victim info, and SOS audio playback
- **Severity Management** -- manually update severity levels or let the AI reassess after follow-ups
- **Mark as Resolved** -- resolve incidents to remove them from both dispatcher and victim views
- **Live Calling** -- initiate WebRTC audio calls to victims with ringing and retry logic
- **Authentication** -- email/password and Google OAuth, with route protection via middleware

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router), TypeScript |
| Styling | Tailwind CSS, shadcn/ui |
| Database & Realtime | Supabase (Postgres, Storage, Realtime) |
| Auth | Supabase Auth (@supabase/ssr) |
| PWA | @serwist/next |
| Maps | react-leaflet, Leaflet |
| AI Reasoning | Featherless.ai (DeepSeek-V3-0324) |
| Speech-to-Text | ElevenLabs (scribe_v1) |
| Text-to-Speech | ElevenLabs (eleven_multilingual_v2) |
| Live Calls | WebRTC with Supabase Realtime signaling |
| Push Notifications | Web Push API, web-push |

## Getting Started

### Prerequisites
- Node.js 18+
- A Supabase project with the `emergencies`, `messages`, and `push_subscriptions` tables created
- API keys for Featherless.ai and ElevenLabs

### Setup

1. Install dependencies:
```bash
npm install
```

2. Copy the environment template and fill in your keys:
```bash
cp .env.local.example .env.local
```

Required environment variables:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
FEATHERLESS_API_KEY=your-featherless-key
ELEVENLABS_API_KEY=your-elevenlabs-key
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) for the victim view, and [http://localhost:3000/dispatcher](http://localhost:3000/dispatcher) for the dispatcher dashboard.

### Build for Production

```bash
npm run build
npm start
```

The production build uses Webpack (required for Serwist service worker generation).

## Architecture

```
src/
├── app/
│   ├── page.tsx                  # Victim PWA shell
│   ├── dispatcher/page.tsx       # Dispatcher dashboard
│   ├── login/page.tsx            # Auth page
│   ├── auth/callback/route.ts    # OAuth callback
│   ├── api/
│   │   ├── process-sos/route.ts  # AI triage pipeline
│   │   ├── follow-up/route.ts    # AI follow-up conversation
│   │   └── push/                 # Push notification endpoints
│   └── sw.ts                     # Service worker
├── components/
│   ├── victim/                   # SOSView, FollowUpChat, FeedView, etc.
│   ├── dispatcher/               # MapView, PriorityQueue, CrisisCard
│   └── ui/                       # shadcn/ui components
├── hooks/
│   ├── useMediaRecorder.ts       # Microphone capture
│   ├── useGeolocation.ts         # GPS coordinates
│   └── useWebRTC.ts              # Peer-to-peer calling
├── lib/
│   ├── ai.ts                     # ElevenLabs & Featherless utilities
│   └── supabase/                 # Client & server Supabase clients
└── middleware.ts                  # Route protection & session refresh
```

## AI Pipeline

1. **Victim sends SOS** (voice recording or text)
2. **ElevenLabs STT** transcribes the audio
3. **Featherless AI** triages the emergency, outputs severity, incident type, and summary as JSON
4. **First follow-up question** is generated and spoken back to the victim via ElevenLabs TTS
5. **Conversation loop** -- AI asks targeted questions, avoids redundant info (GPS, name, medical already known)
6. **Dynamic reassessment** -- after each follow-up, severity and summary are updated in the database
7. **Dispatchers see everything** in real time via Supabase Realtime subscriptions
