"use client";

import Link from "next/link";
import { ShieldX } from "lucide-react";

export default function AccessDeniedPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-[#0a0a0f] p-6">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-950">
        <ShieldX className="h-10 w-10 text-red-500" />
      </div>
      <h1 className="text-2xl font-bold text-white">Access Denied</h1>
      <p className="max-w-sm text-center text-slate-400">
        You don&apos;t have permission to access the dispatcher platform. Contact an administrator to request access.
      </p>
      <Link
        href="/"
        className="inline-flex h-9 items-center justify-center rounded-lg border border-white/20 bg-white/5 px-4 text-sm font-medium text-white transition-colors hover:bg-white/10"
      >
        Return to Home
      </Link>
    </main>
  );
}
