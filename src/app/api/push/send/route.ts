import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function POST(request: Request) {
  try {
    const { title, body } = await request.json();

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    if (!vapidPublicKey || !vapidPrivateKey) {
      return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
    }

    webpush.setVapidDetails(
      "mailto:admin@crisisbridge.app",
      vapidPublicKey,
      vapidPrivateKey,
    );

    const supabase = getSupabase();
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("subscription");

    if (!subs || subs.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: "/icons/icon-192.png",
    });

    const results = await Promise.allSettled(
      subs.map((s) =>
        webpush.sendNotification(JSON.parse(s.subscription), payload),
      ),
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    return NextResponse.json({ sent });
  } catch (err) {
    console.error("Push send error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
