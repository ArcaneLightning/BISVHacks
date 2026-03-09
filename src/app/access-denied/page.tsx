"use client";

import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AccessDeniedPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-black p-6">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-950">
        <ShieldX className="h-10 w-10 text-red-500" />
      </div>
      <h1 className="text-2xl font-bold text-white">Access Denied</h1>
      <p className="max-w-sm text-center text-gray-400">
        You don&apos;t have permission to access the dispatcher platform. Contact an administrator to request access.
      </p>
      <Button asChild variant="outline" className="border-gray-700 text-white hover:bg-gray-800">
        <Link href="/">Return to Home</Link>
      </Button>
    </main>
  );
}
