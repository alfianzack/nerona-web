import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";
import { safeCallbackUrl } from "./auth-redirect";

export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    // src/middleware.ts records the request path as x-pathname, the same way it
    // passes the CSP nonce through. Without it the intended destination is lost
    // and every sign-in lands on the default home.
    const intended = safeCallbackUrl(headers().get("x-pathname"));
    redirect(intended ? `/login?callbackUrl=${encodeURIComponent(intended)}` : "/login");
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireUser();
  if (!session.user.role) {
    // Their own home, not /profile — /profile was arbitrary.
    redirect("/dashboard");
  }
  return session;
}
