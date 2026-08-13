import { cn } from "./cn";
import { Card } from "./Card";
import { Icon, type IconName } from "./icons";

/**
 * Angka ringkasan.
 *
 * Dua hal yang berubah dari versi yang ditulis ulang di dashboard, finance,
 * dan admin: labelnya memakai mono huruf kapital kecil sehingga tidak lagi
 * bersaing dengan angkanya, dan angkanya sendiri memakai mono dengan
 * `tabular-nums` supaya kolom "1.240" dan "86" benar-benar berbaris.
 *
 * `tone`, `icon`, dan `hint` bertipe ReactNode ada karena ketiganya hilang
 * saat dashboard admin dimigrasi, dan hilangnya membawa arti: ubin "Order
 * menunggu" dulu memakai cincin begitu antriannya terisi, dan petunjuk
 * "+N minggu ini" dulu berwarna. Menambalnya lewat className tidak bisa —
 * penimpaan warna gagal diam-diam, sebabnya ditulis di Card.tsx — jadi
 * kebutuhannya naik jadi prop.
 */
export function Stat({
  label,
  value,
  hint,
  icon,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: IconName;
  /** `attention` menyalakan cincin aksen — untuk angka yang menuntut tindakan. */
  tone?: "default" | "attention";
  className?: string;
}) {
  return (
    <Card
      variant={tone === "attention" ? "accent" : "default"}
      className={cn("flex flex-col gap-1", className)}
    >
      <p className="flex items-center gap-1.5 font-mono text-label uppercase text-muted">
        {icon && <Icon name={icon} className="h-3.5 w-3.5 flex-none" />}
        {label}
      </p>
      <p className="font-mono text-title-1 tabular-nums text-ink">{value}</p>
      {hint && <p className="text-caption text-muted">{hint}</p>}
    </Card>
  );
}
