import { NextResponse } from "next/server";

const COOKIE_NAME = "dispatcher_access";
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours

export async function POST(request: Request) {
  try {
    const { code } = await request.json();
    const expected = process.env.DISPATCHER_ACCESS_CODE;

    if (!expected) {
      return NextResponse.json({ ok: false, error: "Not configured" }, { status: 500 });
    }

    if (code && String(code).trim() === expected) {
      const res = NextResponse.json({ ok: true });
      res.cookies.set(COOKIE_NAME, "1", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: COOKIE_MAX_AGE,
        path: "/",
      });
      return res;
    }

    return NextResponse.json({ ok: false, error: "Invalid code" }, { status: 401 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
