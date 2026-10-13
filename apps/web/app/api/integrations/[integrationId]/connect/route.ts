import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import { connectMyIntegration } from "@/lib/services/integrations.service";
import {
  IntegrationNotConfiguredError,
  IntegrationNotFoundError,
} from "@/lib/integrations/types";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ integrationId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { integrationId } = await params;
  try {
    const result = await connectMyIntegration(integrationId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof IntegrationNotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (err instanceof IntegrationNotConfiguredError) {
      // 501: the route is real, the capability just isn't wired up yet.
      return NextResponse.json(
        { error: "not_configured", message: err.message },
        { status: 501 },
      );
    }
    throw err;
  }
}
