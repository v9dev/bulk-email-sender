// src/middleware/auth.ts
import { Context, Next } from "hono";
import { userDatabase, User } from "../services/userDatabase";

// Extend Context type to include user
declare module "hono" {
  interface Context {
    user?: User;
  }
}

export async function authMiddleware(c: Context, next: Next) {
  // Skip auth for login/register pages and static files
  const path = c.req.path;
  const publicPaths = [
    "/login",
    "/register",
    "/auth",
    "/public",
    "/css",
    "/js",
  ];

  if (publicPaths.some((p) => path.startsWith(p)) || path === "/") {
    return await next();
  }

  // Check for session token
  const token =
    c.req.header("Authorization")?.replace("Bearer ", "") ||
    c.req.cookie("session_token");

  if (!token) {
    return c.json({ success: false, message: "Authentication required" }, 401);
  }

  const user = userDatabase.validateSession(token);
  if (!user) {
    return c.json(
      { success: false, message: "Invalid or expired session" },
      401
    );
  }

  // Add user to context
  c.user = user;
  return await next();
}

export function requireAuth(c: Context): User {
  if (!c.user) {
    throw new Error("User not authenticated");
  }
  return c.user;
}
