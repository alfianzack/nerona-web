// Server-rendered area sparkline. The brand orange (#FF8B45) fails the 3:1
// contrast check on white, so line colors are passed in pre-darkened.
export function Sparkline({
  data,
  lineColor,
  fillColor,
  label,
}: {
  data: number[];
  lineColor: string;
  fillColor: string;
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
          stroke="rgba(22,35,61,.07)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <path d={area} fill={fillColor} />
      <path
        d={line}
        fill="none"
        stroke={lineColor}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={last[0]}
        cy={last[1]}
        r={4}
        fill={lineColor}
        stroke="#FFFFFF"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <text
        x={last[0] + 10}
        y={last[1] + 4}
        fontSize={12}
        fontWeight={600}
        fill="#16233D"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {data[data.length - 1]}
      </text>
    </svg>
  );
}
