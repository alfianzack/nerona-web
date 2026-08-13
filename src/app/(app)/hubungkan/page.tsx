import { requireUser } from "@/lib/session-guards";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
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
    // main, bukan div: cangkang aplikasi sengaja tidak memasang landmark-nya
    // sendiri karena setiap halaman tenant memilikinya masing-masing, dan
    // halaman ini satu-satunya yang melewatkannya.
    <main className="bg-canvas">
      <div className="mx-auto max-w-lg px-6 py-band">
        <PageHeader
          title="Hubungkan perangkat"
          description="Cocokkan kode di bawah ini dengan yang tampil di layar Nerona Hub."
        />

        <Card className="mt-8">
          <FormPersetujuan kodeAwal={kode ?? ""} />
        </Card>

        {/* Peringatan, bukan kartu biasa: warnanya harus terbaca sebagai risiko
            keamanan sebelum kalimatnya dibaca. Card tidak punya varian bahaya,
            dan menimpanya lewat className gagal diam-diam — sebabnya ditulis di
            Card.tsx — jadi elemennya berdiri sendiri dengan token status. */}
        <p className="mt-4 rounded-card bg-danger-bg p-4 text-body text-ink ring-1 ring-danger/25">
          Kalau kamu tidak sedang membuka Nerona Hub, jangan setujui. Menyetujui berarti
          memberi perangkat itu akses penuh ke akun dan poinmu.
        </p>
      </div>
    </main>
  );
}
