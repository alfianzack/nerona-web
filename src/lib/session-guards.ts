import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";

export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/api/auth/signin");
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireUser();
  if (!session.user.role) {
    redirect("/account");
  }
  return session;
}
