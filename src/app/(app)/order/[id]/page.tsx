import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session-guards";
import { getUserOrder } from "@/lib/orders";
import { agentTiers, metadataTiers } from "@/lib/pricing-tiers";
import { getPaymentSettings, isPaymentConfigured } from "@/lib/payment-settings";
import { formatRupiah } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { amountForOrder, gatewayEnabled } from "@/lib/payments/orders";
import { tampakMuatanQris } from "@/lib/payments/sumopod";
import { qrisSvg } from "@/lib/payments/qr";
import { PaymentProofUpload } from "@/components/order/PaymentProofUpload";
import { PilihanPembayaran } from "@/components/order/PilihanPembayaran";
import { QrisPayButton } from "@/components/order/QrisPayButton";
import { SegarkanSaatFokus } from "@/components/order/SegarkanSaatFokus";

function statusBanner(status: string, hasProof: boolean) {
  if (status === "fulfilled") {
    return { text: "Paket aktif — terima kasih!", tone: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20" };
  }
  if (status === "cancelled") {
    return { text: "Order dibatalkan.", tone: "bg-rose-500/10 text-rose-600 ring-rose-500/20" };
  }
  if (hasProof) {
    return {
      text: "Bukti transfer terkirim — menunggu verifikasi admin.",
      tone: "bg-brand-blue/10 text-brand-blue ring-brand-blue/20",
    };
  }
  return {
    text: "Menunggu pembayaran. Transfer ke rekening di bawah, lalu unggah buktinya.",
    tone: "bg-gold-400/15 text-gold-600 ring-gold-400/30",
  };
}

async function priceFor(order: {
  product: string;
  planName: string;
  durationMonths: number;
  priceAmount: number | null;
}): Promise<string> {
  // Top-up membawa harganya sendiri: yang berlaku adalah harga saat order
  // dibuat, bukan harga paket poin hari ini.
  if (order.product === "points") {
    return order.priceAmount === null ? "Hubungi admin" : formatRupiah(order.priceAmount);
  }
  const tiers =
    order.product === "metadata"
      ? await metadataTiers(order.durationMonths)
      : await agentTiers(order.durationMonths);
  return tiers.find((t) => t.name === order.planName)?.priceLabel ?? "Hubungi admin";
}

function orderTitle(product: string, planName: string): string {
  if (product === "points") return `Top-up poin — ${planName}`;
  return `${product === "metadata" ? "Nerona Metadata" : "Nerona Agent"} — ${planName}`;
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { bayar?: string };
}) {
  const session = await requireUser();
  const order = await getUserOrder(session.user.id, params.id);
  if (!order) {
    notFound();
  }

  const [price, bank, qrisAktif, tagihanHidup] = await Promise.all([
    priceFor(order),
    getPaymentSettings(),
    gatewayEnabled(),
    prisma.payment.findFirst({
      where: {
        orderId: order.id,
        status: "pending",
        expiresAt: { gt: new Date() },
        linkUrl: { not: "" },
      },
      orderBy: { createdAt: "desc" },
      select: { linkUrl: true, expiresAt: true, paymentCode: true },
    }),
  ]);

  // QR digambar di server, jadi halaman order tidak menambah satu kilobyte pun
  // JavaScript untuk ini. `null` kalau kodenya bukan muatan QRIS — pemeriksaan
  // bentuk, bukan kepercayaan pada nama tipe.
  const qrSvg =
    tagihanHidup && tampakMuatanQris(tagihanHidup.paymentCode)
      ? await qrisSvg(tagihanHidup.paymentCode!)
      : null;

  const hasProof = Boolean(order.proofUploadedAt);
  const banner = statusBanner(order.status, hasProof);
  const isPending = order.status === "pending";
  const bankReady = isPaymentConfigured(bank);
  // QRIS hanya untuk yang punya harga angka. Paket "Hubungi kami" dan produk di
  // luar lingkup tetap lewat transfer manual, tanpa tombol yang menjanjikan
  // sesuatu yang akan gagal saat ditekan.
  const bisaQris = isPending && qrisAktif && (await amountForOrder(order)) !== null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-14 sm:py-16">
      <Link href="/transaksi" className="text-sm text-brand-blue hover:underline">
        ‹ Semua transaksi
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
        {orderTitle(order.product, order.planName)}
      </h1>

      <div className={`mt-4 rounded-2xl px-4 py-3 text-sm font-medium ring-1 ${banner.tone}`}>
        {banner.text}
      </div>

      {isPending && (
        <a
          href={`/api/orders/${order.id}/invoice`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm font-medium text-brand-blue hover:underline"
        >
          Unduh invoice (PDF) ↗
        </a>
      )}

      {/*
        Hanya selagi menunggu: order yang sudah lunas atau dibatalkan tidak punya
        apa pun untuk disegarkan, dan pendengar yang tetap hidup di sana cuma
        memicu permintaan tiap kali tab dipindah.
      */}
      {isPending && <SegarkanSaatFokus />}

      {isPending && (
        <PilihanPembayaran
          qrisTersedia={bisaQris}
          awal={searchParams.bayar === "transfer" ? "transfer" : "qris"}
          panelQris={
            <div className="rounded-3xl bg-gradient-to-b from-surface to-surface2 p-6 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
              {qrSvg ? (
                <>
                  <p className="text-sm text-muted">
                    Pindai dengan aplikasi bank atau e-wallet apa pun. Jumlahnya{" "}
                    <span className="font-semibold text-ink">{price}</span> — tidak ada biaya
                    tambahan.
                  </p>
                  {/*
                    Latar putih di bawah QR bukan pilihan gaya: kamera memindai
                    kontras, dan QR di atas kartu bergradien gagal terbaca di
                    sebagian perangkat.
                  */}
                  <div
                    className="mx-auto mt-4 w-fit rounded-2xl bg-white p-3 ring-1 ring-navy-900/10 [&>svg]:block [&>svg]:h-auto [&>svg]:w-[240px]"
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  />
                  <p className="mt-4 text-center text-xs text-muted">
                    Berlaku sampai{" "}
                    {tagihanHidup!.expiresAt.toLocaleString("id-ID", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                    . Paket aktif sendiri beberapa detik setelah pembayaran masuk — tidak perlu
                    mengunggah bukti.
                  </p>
                  <p className="mt-2 text-center text-xs text-muted/80">
                    Tidak bisa memindai dari perangkat ini?{" "}
                    <a
                      href={tagihanHidup!.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-brand-blue hover:underline"
                    >
                      Buka halaman bayar ↗
                    </a>{" "}
                    — tutup tabnya setelah membayar, halaman ini memperbarui statusnya sendiri.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted">
                    Pindai QRIS dari aplikasi bank atau e-wallet apa pun. Jumlahnya{" "}
                    <span className="font-semibold text-ink">{price}</span> — tidak ada biaya
                    tambahan.
                  </p>
                  <div className="mt-4">
                    <QrisPayButton
                      orderId={order.id}
                      tautanAktif={tagihanHidup?.linkUrl ?? null}
                      kedaluwarsa={
                        tagihanHidup
                          ? tagihanHidup.expiresAt.toLocaleString("id-ID", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : null
                      }
                    />
                  </div>
                </>
              )}
            </div>
          }
          panelTransfer={
            <div className="rounded-3xl bg-gradient-to-b from-surface to-surface2 p-6 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Detail transfer
              </h2>
              {bankReady ? (
                <dl className="mt-3 space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">Bank</dt>
                    <dd className="font-medium text-ink">{bank.bankName}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">Nomor rekening</dt>
                    <dd className="rounded-lg bg-navy-900/5 px-2.5 py-1 font-mono text-ink ring-1 ring-navy-900/10">
                      {bank.accountNumber}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">Atas nama</dt>
                    <dd className="font-medium text-ink">{bank.accountHolder}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-navy-900/10 pt-3">
                    <dt className="text-muted">Jumlah transfer</dt>
                    <dd className="text-lg font-extrabold text-brand-blue">{price}</dd>
                  </div>
                  {bank.instructions && (
                    <p className="border-t border-navy-900/10 pt-3 text-xs text-muted">
                      {bank.instructions}
                    </p>
                  )}
                  <p className="border-t border-navy-900/10 pt-3 text-xs text-muted">
                    Setelah transfer, unggah buktinya di bawah. Paket aktif setelah admin
                    mengonfirmasi.
                  </p>
                </dl>
              ) : (
                <p className="mt-3 text-sm text-muted">
                  Rekening pembayaran belum diatur. Silakan hubungi admin Nerona.
                </p>
              )}
            </div>
          }
        />
      )}

      <section className="mt-6 rounded-3xl bg-gradient-to-b from-surface to-surface2 p-6 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Bukti pembayaran
        </h2>
        <div className="mt-3">
          {isPending ? (
            <PaymentProofUpload orderId={order.id} hasProof={hasProof} />
          ) : hasProof ? (
            <PaymentProofUpload orderId={order.id} hasProof disabled />
          ) : (
            <p className="text-sm text-muted">Tidak ada bukti pembayaran.</p>
          )}
        </div>
      </section>
    </main>
  );
}
