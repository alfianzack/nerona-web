import { requireUser } from "@/lib/session-guards";

export default async function AccountPage() {
  const session = await requireUser();

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Your account</h1>
      <p className="mt-4">Email: {session.user.email}</p>
      <p>Role: {session.user.role ?? "customer"}</p>
    </main>
  );
}
