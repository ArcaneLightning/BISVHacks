CrisisBridge: AI Agent Instructions

You are an expert full-stack developer building "CrisisBridge", a Next.js (App Router) Progressive Web App (PWA) for emergency dispatch triage. Your goal is to build the complete, functional application using the stack and strict UI guidelines below.

1. Tech Stack

Framework: Next.js 15 (App Router) with TypeScript

Styling: Tailwind CSS + shadcn/ui

Database & Storage: Supabase (Postgres, Storage Buckets, Realtime Subscriptions)

PWA Engine: @serwist/next (for service workers and offline fallback)

Map: react-leaflet (must be dynamically imported with ssr: false)

AI APIs: Featherless.ai (Reasoning) and ElevenLabs (Speech/Audio)

2. Supabase Database Schema

Note to Agent: Assume this table is already created. You only need to interact with it via the @supabase/supabase-js client.

CREATE TABLE emergencies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_name TEXT,
  medical_context TEXT,
  lat FLOAT,
  lng FLOAT,
  audio_url TEXT,
  transcript TEXT,
  severity INTEGER, -- Scale of 1 to 5
  incident_type TEXT,
  translated_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);


3. shadcn/ui & UI/UX Guidelines

We have two distinct user interfaces. You must use shadcn/ui components to build them. Install these components via CLI:
npx shadcn-ui@latest add button card input label badge scroll-area dialog sheet separator avatar

A. The Victim PWA (Mobile-First)

Vibe: Extremely high contrast, minimal distractions, massive touch targets.

Onboarding View: Use a Card component for the "Guest" vs. "Log In" flow. If they log in, capture Name, Age, and Medical Context using Input and Label. Save this to localStorage (do not use a database for user profiles).

SOS View:

Center the UI. The main interaction is a massive Button.

Use Tailwind to make the button rounded-full, h-48, w-48. Use the destructive variant (red) and add a pulsing Tailwind animation (animate-pulse) when isRecording is true.

B. The Dispatcher Dashboard (Desktop Command Center)

Vibe: Dark mode by default (bg-slate-950). Information-dense but highly scannable.

Layout: A persistent Sidebar or left-aligned ScrollArea for the Priority Queue, and a main content area for the react-leaflet map.

Priority Queue (List):

Render incoming emergencies in a ScrollArea. Sort them by severity descending.

Use Badge components for severity. Crucial: Apply semantic colors to the badges: Severity 5 = bg-red-600, 4 = bg-orange-500, 3 = bg-yellow-500.

Crisis Card Modal:

When a dispatcher clicks an incident in the sidebar or a map pin, open a Sheet or Dialog.

Display the translated_summary, incident_type, and the victim's medical_context.

Provide a Button to play the raw .webm audio file from the Supabase audio_url.

4. The Hardware / Sensor Logic

Audio: Use the standard HTML5 MediaRecorder API to capture microphone audio. Output a .webm Blob.

Location: Use navigator.geolocation.getCurrentPosition() to get the lat and lng.

Storage: Immediately upload the .webm Blob to a public Supabase Storage bucket named audio-files. Retrieve the public URL.

5. The AI API Pipeline

Once the audio is uploaded, send the URL, GPS, and LocalStorage profile to a Next.js API route (/api/process-sos) which performs this exact chain:

Step 1: ElevenLabs (Transcription)
Send the audio URL to ElevenLabs Speech-to-Text API to get the raw, potentially non-English transcript.

Step 2: Featherless.ai (The Brain)
Send the transcript to https://api.featherless.ai/v1/chat/completions.

Model: deepseek-ai/DeepSeek-V3-0324

System Prompt (Must enforce strict JSON):
"You are CrisisBridge, an expert AI emergency triage system. Output ONLY raw, valid JSON. Evaluate the provided text, GPS location, and User Profile. Calculate the severity (1-5). Schema: { \"severity\": INTEGER, \"incident_type\": \"Fire | Medical | Assault | Natural Disaster | Other\", \"translated_summary\": \"A clear, 2-sentence English summary.\", \"critical_context\": \"Vital info extracted from the User Profile.\" }"

User Prompt:
"Transcript: '{transcript}' | GPS: {lat}, {lng} | User Profile: {local_storage_profile}"

Step 3: Database & Synthesis

Insert the resulting JSON, original transcript, GPS, and Audio URL into the Supabase emergencies table.

Send a reassuring phrase (e.g., "Help is on the way.") to ElevenLabs Text-to-Speech API. Return the audio buffer to the frontend to auto-play to the victim.

6. Real-time Subscription

On the Dispatcher page, you MUST use Supabase's realtime .channel('live-map') to listen for INSERT events on the emergencies table. When a new row is inserted, update the React state immediately so the map pin drops and the sidebar queue updates without a page refresh.

7. Execution Order

Scaffold the Next.js app, configure Tailwind/shadcn, and set up @serwist/next in next.config.ts.

Build the UI components (Mobile Victim view & Desktop Dispatcher dashboard).

Implement MediaRecorder and navigator.geolocation hooks.

Implement Supabase Storage upload and the Real-time listeners.

Build the /api/process-sos route chaining ElevenLabs and Featherless.ai.