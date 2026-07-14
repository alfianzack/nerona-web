import { requireAdmin } from "@/lib/session-guards";

export default async function AdminPage() {
  const session = await requireAdmin();

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Admin</h1>
      <p className="mt-4">
        Signed in as {session.user.email} ({session.user.role})
      </p>
    </main>
  );
}
