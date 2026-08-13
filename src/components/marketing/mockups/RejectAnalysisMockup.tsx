const FINDINGS = [
  {
    lead: "Noise di area langit.",
    body: "Terlihat jelas pada 100% di kuadran kanan atas, paling mungkin dari ISO tinggi.",
  },
  {
    lead: "Perbaiki lalu unggah ulang.",
    body: "Kurangi noise pada langit saja — jangan seluruh bingkai, detail gedung akan ikut hilang.",
  },
  {
    lead: "Judul & kata kunci tidak jadi masalah.",
    body: "Keduanya sesuai; tidak perlu diubah.",
  },
];

/**
 * Kartu gelap: satu-satunya mockup yang duduk di band navy.
 *
 * Token permukaan (ink, muted, border) sengaja tidak dipakai di sini — nilainya
 * disetel untuk latar terang, dan di atas navy semuanya jadi tidak terbaca.
 * Yang dipakai: putih beralfa untuk permukaan dan garis, navy-100 untuk teks
 * badan, dan token `danger` hanya sebagai isian serta garis, bukan warna teks.
 */
export function RejectAnalysisMockup() {
  return (
    <div className="rounded-card bg-white/5 p-7 ring-1 ring-white/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-label uppercase text-navy-100/75">Analisis penolakan</p>
        <span className="rounded-chip bg-danger/25 px-2.5 py-1 font-mono text-label font-semibold uppercase text-white ring-1 ring-danger/40">
          Adobe Stock · Ditolak
        </span>
      </div>
      <p className="mt-4 rounded-r-card border-l-[3px] border-danger bg-white/5 px-3.5 py-3 text-body italic text-navy-100">
        &ldquo;Quality issues — noise, artifacts or film grain&rdquo;
      </p>
      <ul className="mt-4 space-y-3 text-body text-navy-100">
        {FINDINGS.map((finding) => (
          <li key={finding.lead} className="flex items-start gap-2.5">
            <span
              className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-brand-sky"
              aria-hidden="true"
            />
            <span>
              <b className="font-semibold text-white">{finding.lead}</b> {finding.body}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
