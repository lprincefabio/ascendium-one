import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { universalSearch } from "@/lib/services/search";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const results = await universalSearch(user, q);
  return NextResponse.json(results.map(({ id, type, title, subtitle, href, isDemo }) => ({ id, type, title, subtitle, href, isDemo })));
}
