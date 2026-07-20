import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return new NextResponse(
    `self.register("/sw.js");`,
    { headers: { "Content-Type": "application/javascript" } }
  );
}
