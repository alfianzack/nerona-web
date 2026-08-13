/**
 * Grafik area kecil, dirender di server.
 *
 * Warnanya dulu dioper per pemanggilan sebagai hex lepas justru karena oranye
 * merek (#FF8B45) gagal uji kontras 3:1 di atas putih dan harus digelapkan
 * manual di tempat pemanggilan. Token sekarang sudah membawa varian
 * aman-kontrasnya sendiri — `emphasis` ADALAH oranye yang digelapkan itu — jadi
 * pemanggil cukup menyebut nadanya dan tidak ada lagi hex yang bisa salah
 * ketik atau melenceng dari layar lain.
 *
 * `vectorEffect="non-scaling-stroke"` tetap dipertahankan: viewBox-nya
 * diregangkan (preserveAspectRatio="none"), jadi tanpa itu garisnya ikut
 * menebal mengikuti lebar kartu.
 */
type SparklineTone = "accent" | "emphasis";

/**
 * Nama kelasnya ditulis utuh, bukan dirakit dari potongan string. Pemindai
 * Tailwind membaca berkas ini sebagai teks biasa: kelas yang tidak pernah
 * muncul lengkap tidak akan pernah dibuat, dan grafiknya terbit tanpa warna.
 */
const TONES: Record<SparklineTone, { line: string; area: string; dot: string }> = {
  accent: { line: "stroke-accent", area: "fill-accent/10", dot: "fill-accent" },
  emphasis: { line: "stroke-emphasis", area: "fill-emphasis/10", dot: "fill-emphasis" },
};

export function Sparkline({
  data,
  tone,
  label,
}: {
  data: number[];
  tone: SparklineTone;
  label: string;
}) {
  const W = 560;
  const H = 96;
  const PAD = 6;
  const LABEL_W = 34;
  const max = Math.max(...data, 1);
  const innerW = W - PAD * 2 - LABEL_W;
  const innerH = H - PAD * 2;
  const points = data.map((value, i) => [
    PAD + (i / Math.max(data.length - 1, 1)) * innerW,
    PAD + innerH - (value / max) * innerH,
  ]);
  const line = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const last = points[points.length - 1];
  const area = `${line} L ${last[0].toFixed(1)} ${H - PAD} L ${PAD} ${H - PAD} Z`;
  const color = TONES[tone];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      className="mt-3 block h-24 w-full"
    >
      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1={PAD}
          y1={PAD + innerH * f}
          x2={W - PAD - LABEL_W}
          y2={PAD + innerH * f}
          className="stroke-border"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <path d={area} className={color.area} />
      <path
        d={line}
        fill="none"
        className={color.line}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* Titik ujung: isian ikut nada, lingkaran luarnya memakai warna
          permukaan supaya tetap terbaca saat garisnya menempel di kisi. Isian
          dan garis luar menyetel properti berbeda, jadi dua kelas warna di satu
          elemen ini tidak saling meniadakan. */}
      <circle
        cx={last[0]}
        cy={last[1]}
        r={4}
        className={`${color.dot} stroke-surface`}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <text
        x={last[0] + 10}
        y={last[1] + 4}
        fontSize={12}
        fontWeight={600}
        className="fill-ink font-mono tabular-nums"
      >
        {data[data.length - 1]}
      </text>
    </svg>
  );
}
