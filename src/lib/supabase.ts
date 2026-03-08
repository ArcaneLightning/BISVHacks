import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Emergency = {
  id: string;
  user_name: string | null;
  medical_context: string | null;
  lat: number | null;
  lng: number | null;
  audio_url: string | null;
  transcript: string | null;
  severity: number | null;
  incident_type: string | null;
  translated_summary: string | null;
  status: string | null;
  created_at: string;
};

export type Message = {
  id: string;
  emergency_id: string;
  role: "user" | "ai" | "dispatcher";
  content: string;
  audio_url: string | null;
  created_at: string;
};

let _supabase: SupabaseClient | null = null;

export function getSupabase() {
  if (!_supabase) {
    _supabase = createClient();
  }
  return _supabase;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
