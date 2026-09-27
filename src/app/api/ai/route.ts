import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { permissionLevelFor } from "@/lib/auth";
import { answerQuestion } from "@/lib/services/ai";

const schema = z.object({ question: z.string().min(3).max(2000) });

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!permissionLevelFor(user, "ai", "read")) return NextResponse.json({ error: "AI assistant not permitted for this role" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Question required (3–2000 characters)" }, { status: 400 });

  const answer = await answerQuestion(user, parsed.data.question);
  return NextResponse.json(answer);
}
