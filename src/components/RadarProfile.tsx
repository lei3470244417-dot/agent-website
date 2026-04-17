import { useId, useMemo, useState } from "react";
import type { RadarDatum } from "../lib/profileRadar";

type Props = {
  data: RadarDatum[];
  className?: string;
};

function polar(cx: number, cy: number, radius: number, angle: number) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

export function RadarProfile({ data, className = "" }: Props) {
  const gradId = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);

  const n = Math.max(data.length, 1);
  const cx = 200;
  const cy = 200;
  const maxR = 120;
  const labelR = maxR + 28;

  const angles = useMemo(
    () => data.map((_, i) => -Math.PI / 2 + (2 * Math.PI * i) / n),
    [data, n]
  );

  const ringPolygons = useMemo(() => {
    const levels = [0.25, 0.5, 0.75, 1];
    return levels.map((t) =>
      angles
        .map((a) => {
          const { x, y } = polar(cx, cy, maxR * t, a);
          return `${x},${y}`;
        })
        .join(" ")
    );
  }, [angles, cx, cy, maxR]);

  const axisLines = useMemo(
    () =>
      angles.map((a) => {
        const { x, y } = polar(cx, cy, maxR, a);
        return { x1: cx, y1: cy, x2: x, y2: y };
      }),
    [angles, cx, cy, maxR]
  );

  const dataPoints = useMemo(
    () =>
      data.map((d, i) => {
        const t = d.score / (d.fullMark || 100);
        return polar(cx, cy, maxR * Math.min(1, Math.max(0, t)), angles[i]);
      }),
    [data, angles, cx, cy, maxR]
  );

  const dataPolygon = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-glass ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-mesh opacity-60" />
      <div className="relative p-4 sm:p-6">
        <h3 className="font-display text-lg font-semibold tracking-tight text-white">
          能力雷达
        </h3>
        <p className="mt-1 text-sm text-ink-400">
          根据简历关键词启发式估算；接入智能体后可改为模型打分
        </p>
        <div className="mt-4 flex h-[280px] w-full items-center justify-center sm:h-[320px]">
          <svg
            viewBox="0 0 400 400"
            className="h-full max-h-[320px] w-full max-w-[400px]"
            role="img"
            aria-label="能力雷达图"
          >
            <defs>
              <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.45" />
              </linearGradient>
            </defs>

            {ringPolygons.map((pts, i) => (
              <polygon
                key={i}
                points={pts}
                fill="none"
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="1"
              />
            ))}

            {axisLines.map((l, i) => (
              <line
                key={i}
                x1={l.x1}
                y1={l.y1}
                x2={l.x2}
                y2={l.y2}
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="1"
              />
            ))}

            <polygon
              points={dataPolygon}
              fill={`url(#${gradId})`}
              stroke="#a5b4fc"
              strokeWidth="2"
              strokeLinejoin="round"
            />

            {dataPoints.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={hover === i ? 6 : 4}
                fill="#e8ecf6"
                stroke="#6366f1"
                strokeWidth="1.5"
                className="cursor-default"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <title>
                  {data[i]?.subject ?? ""}：{data[i]?.score ?? 0} /{" "}
                  {data[i]?.fullMark ?? 100}
                </title>
              </circle>
            ))}

            {data.map((d, i) => {
              const { x, y } = polar(cx, cy, labelR, angles[i]);
              let anchor: "start" | "middle" | "end" = "middle";
              if (x < cx - 20) anchor = "end";
              else if (x > cx + 20) anchor = "start";
              return (
                <text
                  key={i}
                  x={x}
                  y={y}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  fill="#b3bfd9"
                  fontSize="11"
                  style={{ fontFamily: "inherit" }}
                >
                  {d.subject}
                </text>
              );
            })}
          </svg>
        </div>
        {hover !== null && data[hover] && (
          <p className="mt-2 text-center text-xs text-accent-glow">
            {data[hover].subject}：{data[hover].score} / {data[hover].fullMark}
          </p>
        )}
      </div>
    </div>
  );
}
