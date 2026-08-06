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

/** Kartu gelap: satu-satunya mockup yang duduk di band navy. */
export function RejectAnalysisMockup() {
  return (
    <div className="rounded-3xl bg-white/5 p-7 ring-1 ring-white/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-navy-100/75">
          Analisis penolakan
        </p>
        <span className="rounded-full bg-rose-400/20 px-2.5 py-0.5 text-[11px] font-semibold text-rose-200">
          Adobe Stock · Ditolak
        </span>
      </div>
      <p className="mt-4 rounded-r-xl border-l-[3px] border-rose-200/60 bg-white/[0.04] px-3.5 py-3 text-[13.5px] italic text-rose-100">
        &ldquo;Quality issues — noise, artifacts or film grain&rdquo;
      </p>
      <ul className="mt-4 space-y-3 text-[13.5px] text-navy-100">
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
