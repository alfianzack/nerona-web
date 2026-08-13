import { cn } from "./cn";
import { Card } from "./Card";

/**
 * Angka ringkasan.
 *
 * Dua hal yang berubah dari versi yang ditulis ulang di dashboard, finance,
 * dan admin: labelnya memakai mono huruf kapital kecil sehingga tidak lagi
 * bersaing dengan angkanya, dan angkanya sendiri memakai mono dengan
 * `tabular-nums` supaya kolom "1.240" dan "86" benar-benar berbaris.
 */
export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col gap-1", className)}>
      <p className="font-mono text-label uppercase text-muted">{label}</p>
      <p className="font-mono text-title-1 tabular-nums text-ink">{value}</p>
      {hint && <p className="text-caption text-muted">{hint}</p>}
    </Card>
  );
}
