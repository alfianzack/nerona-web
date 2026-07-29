import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session-guards";
import { homeForRole, safeCallbackUrl } from "@/lib/auth-redirect";

// One landing point shared by credentials sign-in and Google OAuth. Both used
// to hardcode /dashboard, which discarded the callbackUrl the middleware sets
// and dropped admins onto a tenant page.
//
// This lives outside (auth) on purpose: inside it, that group's "signed-in
// visitors go to their role home" redirect would fire first and swallow `next`.
export default async function PostLoginPage({
  searchParams,
}: {
  searchParams: { next?: string | string[] };
}) {
  const session = await requireUser();

  // A repeated query parameter arrives as string[]; "?next=/a&next=//evil.com"
  // must not slip past a check written for a plain string.
  const next = typeof searchParams.next === "string" ? searchParams.next : null;
  redirect(safeCallbackUrl(next) ?? homeForRole(session.user));
}
