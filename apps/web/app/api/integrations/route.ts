import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import { listMyIntegrations } from "@/lib/services/integrations.service";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const integrations = await listMyIntegrations();
  return NextResponse.json({ integrations });
}
