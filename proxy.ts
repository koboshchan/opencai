import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/api(.*)",
  "/characters(.*)",
  "/chats(.*)",
  "/admin(.*)",
  "/tg-auth(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const authHeader = req.headers.get("authorization");
  if (
    authHeader &&
    authHeader.startsWith("Bearer ") &&
    authHeader.substring(7) === process.env.TELEGRAM_BOT_SECRET
  ) {
    return;
  }
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};