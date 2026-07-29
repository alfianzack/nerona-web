import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { homeForRole } from "@/lib/auth-redirect";

// No chrome: the auth pages are self-contained cards. A signed-in visitor has
// no business on /login or /register, so send them where they belong.
//
// verify-email and reset-password live here too and are therefore redirected as
// well. That is intended — both flows are entered from an email link while
// signed out.
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    redirect(homeForRole(session.user));
  }
  return <>{children}</>;
}
