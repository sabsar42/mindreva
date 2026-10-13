import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import { disconnectMyIntegration } from "@/lib/services/integrations.service";
import { IntegrationNotFoundError } from "@/lib/integrations/types";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ integrationId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { integrationId } = await params;
  try {
    await disconnectMyIntegration(integrationId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof IntegrationNotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw err;
  }
}
