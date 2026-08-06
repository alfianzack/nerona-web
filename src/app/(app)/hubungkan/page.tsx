import { requireUser } from "@/lib/session-guards";
import { FormPersetujuan } from "./FormPersetujuan";

export const metadata = { title: "Hubungkan perangkat — Nerona" };

export default async function HubungkanPage({
  searchParams,
}: {
  searchParams: { kode?: string };
}) {
  // requireUser mengalihkan ke login dengan callbackUrl, jadi pengguna yang
  // belum login kembali ke halaman ini lengkap dengan kodenya.
  await requireUser();
  const kode = searchParams.kode;

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-semibold text-ink">Hubungkan perangkat</h1>
      <p className="mt-2 text-sm text-muted">
        Cocokkan kode di bawah ini dengan yang tampil di layar Nerona Hub.
      </p>
      <div className="mt-6 rounded-3xl bg-gradient-to-b from-surface to-surface2 p-6 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
        <FormPersetujuan kodeAwal={kode ?? ""} />
      </div>
      <p className="mt-4 rounded-2xl bg-rose-500/10 p-4 text-sm text-ink ring-1 ring-rose-500/30">
        Kalau kamu tidak sedang membuka Nerona Hub, jangan setujui. Menyetujui berarti
        memberi perangkat itu akses penuh ke akun dan poinmu.
      </p>
    </div>
  );
}
