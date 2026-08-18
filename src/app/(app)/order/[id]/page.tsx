import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session-guards";
import { getUserOrder } from "@/lib/orders";
import { fullPriceLabel } from "@/components/marketing/PricingTiers";
import { agentTiers, metadataTiers } from "@/lib/pricing-tiers";
import { getPaymentSettings, isPaymentConfigured } from "@/lib/payment-settings";
import { formatRupiah } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { amountForOrder, gatewayEnabled } from "@/lib/payments/orders";
import { tampakMuatanQris } from "@/lib/payments/sumopod";
import { qrisSvg } from "@/lib/payments/qr";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Icon, type IconName } from "@/components/ui/icons";
import { PaymentProofUpload } from "@/components/order/PaymentProofUpload";
import { PilihanPembayaran } from "@/components/order/PilihanPembayaran";
import { QrisPayButton } from "@/components/order/QrisPayButton";
import { SegarkanSaatFokus } from "@/components/order/SegarkanSaatFokus";

/**
 * Spanduk status order.
 *
 * Warnanya dulu empat pasang nilai mentah yang melayang antar langkah; kini
 * peran status: lunas hijau, dibatalkan merah, bukti terkirim biru informasi,
 * menunggu kuning peringatan. Kalimatnya sepanjang satu baris penuh, jadi ini
 * tidak bisa memakai chip Badge — chip itu mono huruf kapital untuk satu-dua
 * kata, dan sebuah kalimat di dalamnya tidak terbaca.
 */
function statusBanner(
  status: string,
  hasProof: boolean,
): { text: string; icon: IconName; tone: string } {
  if (status === "fulfilled") {
    return {
      text: "Paket aktif — terima kasih!",
      icon: "check-circle",
      tone: "bg-success-bg text-success ring-success/25",
    };
  }
  if (status === "cancelled") {
    return {
      text: "Order dibatalkan.",
      icon: "close",
      tone: "bg-danger-bg text-danger ring-danger/25",
    };
  }
  if (hasProof) {
    return {
      text: "Bukti transfer terkirim — menunggu verifikasi admin.",
      icon: "check",
      tone: "bg-brand-blue/10 text-brand-blue-ink ring-brand-blue/25",
    };
  }
  return {
    text: "Menunggu pembayaran. Transfer ke rekening di bawah, lalu unggah buktinya.",
    icon: "clock",
    tone: "bg-warning-bg text-warning ring-warning/25",
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
  const tier = tiers.find((t) => t.name === order.planName);
  return tier ? fullPriceLabel(tier) : "Hubungi admin";
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
    <main className="mx-auto max-w-2xl px-6 py-band">
      <ButtonLink href="/transaksi" variant="ghost" size="sm" className="-ml-3">
        <Icon name="arrow-left" className="h-3.5 w-3.5" />
        Semua transaksi
      </ButtonLink>
      <PageHeader className="mt-3" title={orderTitle(order.product, order.planName)} />

      <div
        className={`mt-5 flex items-start gap-2.5 rounded-card px-4 py-3 text-body font-medium ring-1 ${banner.tone}`}
      >
        <Icon name={banner.icon} className="mt-0.5 h-4 w-4 flex-none" />
        <span>{banner.text}</span>
      </div>

      {isPending && (
        <a
          href={`/api/orders/${order.id}/invoice`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-caption font-medium text-accent transition hover:underline"
        >
          Unduh invoice (PDF)
          <Icon name="external-link" className="h-3.5 w-3.5" />
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
            <Card>
              {qrSvg ? (
                <>
                  <p className="text-body text-muted">
                    Pindai dengan aplikasi bank atau e-wallet apa pun. Jumlahnya{" "}
                    <span className="font-mono font-semibold tabular-nums text-ink">{price}</span>{" "}
                    — tidak ada biaya tambahan.
                  </p>
                  {/*
                    Latar putih di bawah QR bukan pilihan gaya: kamera memindai
                    kontras, dan QR di atas permukaan berwarna gagal terbaca di
                    sebagian perangkat.
                  */}
                  <div
                    className="mx-auto mt-4 w-fit rounded-card bg-white p-3 ring-1 ring-border [&>svg]:block [&>svg]:h-auto [&>svg]:w-[240px]"
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  />
                  <p className="mt-4 text-center text-caption text-muted">
                    Berlaku sampai{" "}
                    <span className="font-mono tabular-nums">
                      {tagihanHidup!.expiresAt.toLocaleString("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                    . Paket aktif sendiri beberapa detik setelah pembayaran masuk — tidak perlu
                    mengunggah bukti.
                  </p>
                  <p className="mt-2 text-center text-caption text-muted">
                    Tidak bisa memindai dari perangkat ini?{" "}
                    <a
                      href={tagihanHidup!.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-accent transition hover:underline"
                    >
                      Buka halaman bayar
                      <Icon name="external-link" className="h-3 w-3" />
                    </a>{" "}
                    — tutup tabnya setelah membayar, halaman ini memperbarui statusnya sendiri.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-body text-muted">
                    Pindai QRIS dari aplikasi bank atau e-wallet apa pun. Jumlahnya{" "}
                    <span className="font-mono font-semibold tabular-nums text-ink">{price}</span>{" "}
                    — tidak ada biaya tambahan.
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
            </Card>
          }
          panelTransfer={
            <Card>
              <h2 className="text-title-2 text-ink">Detail transfer</h2>
              {bankReady ? (
                <dl className="mt-4 space-y-3">
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="font-mono text-label uppercase text-muted">Bank</dt>
                    <dd className="text-body font-medium text-ink">{bank.bankName}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="font-mono text-label uppercase text-muted">Nomor rekening</dt>
                    {/* Nomor yang akan disalin orang ke aplikasi banknya: mono
                        dan tabular supaya digitnya tidak bisa salah dibaca. */}
                    <dd className="rounded-chip bg-surface-sunken px-2.5 py-1 font-mono text-body tabular-nums text-ink ring-1 ring-border">
                      {bank.accountNumber}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="font-mono text-label uppercase text-muted">Atas nama</dt>
                    <dd className="text-body font-medium text-ink">{bank.accountHolder}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4 border-t border-divider pt-3">
                    <dt className="font-mono text-label uppercase text-muted">Jumlah transfer</dt>
                    <dd className="font-mono text-title-2 tabular-nums text-ink">{price}</dd>
                  </div>
                  {bank.instructions && (
                    <p className="border-t border-divider pt-3 text-caption text-muted">
                      {bank.instructions}
                    </p>
                  )}
                  <p className="border-t border-divider pt-3 text-caption text-muted">
                    Setelah transfer, unggah buktinya di bawah. Paket aktif setelah admin
                    mengonfirmasi.
                  </p>
                </dl>
              ) : (
                <p className="mt-3 text-body text-muted">
                  Rekening pembayaran belum diatur. Silakan hubungi admin Nerona.
                </p>
              )}
            </Card>
          }
        />
      )}

      <Card className="mt-6">
        <h2 className="text-title-2 text-ink">Bukti pembayaran</h2>
        <div className="mt-4">
          {isPending ? (
            <PaymentProofUpload orderId={order.id} hasProof={hasProof} />
          ) : hasProof ? (
            <PaymentProofUpload orderId={order.id} hasProof disabled />
          ) : (
            <p className="text-body text-muted">Tidak ada bukti pembayaran.</p>
          )}
        </div>
      </Card>
    </main>
  );
}
