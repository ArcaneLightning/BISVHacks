import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("dispatcher_access")?.value;

    if (token === "1") {
      return NextResponse.json({ allowed: true });
    }

    return NextResponse.json({ allowed: false });
  } catch {
    return NextResponse.json({ allowed: false });
  }
}
