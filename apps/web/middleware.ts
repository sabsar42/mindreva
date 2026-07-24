import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@mindreva/auth/middleware";

const AUTH_ROUTES = ["/sign-in", "/sign-up"];
const PROTECTED_PREFIXES = ["/account", "/record", "/journal", "/chat"];
const ONBOARDING_PREFIX = "/onboarding";

export async function middleware(request: NextRequest) {
  // Always refresh the session first (this also sets any updated auth cookies).
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));
  const isProtected =
    PROTECTED_PREFIXES.some((r) => pathname.startsWith(r)) ||
    pathname.startsWith(ONBOARDING_PREFIX);

  // Signed-out users may not reach protected or onboarding routes.
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  // Signed-in users should not sit on the auth screens.
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/journal";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Run on everything except static assets and image files.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
