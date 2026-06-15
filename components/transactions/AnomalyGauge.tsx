"use client";

interface Props {
  score: number;
  size?: number;
}

export function AnomalyGauge({ score, size = 120 }: Props) {
  const r = (size - 16) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const dash = score * circumference;
  const gap = circumference - dash;

  const color =
    score >= 0.75 ? "#dc2626"
    : score >= 0.50 ? "#f97316"
    : score >= 0.25 ? "#f59e0b"
    : "#22c55e";

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#334155" strokeWidth={12} />
          <circle
            cx={cx} cy={cy} r={r}
            fill="none" stroke={color} strokeWidth={12}
            strokeDasharray={`${dash} ${gap}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.5s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="font-bold text-xl" style={{ color }}>{(score * 100).toFixed(0)}%</p>
          <p className="text-slate-500 text-xs">Risk Score</p>
        </div>
      </div>
    </div>
  );
}
