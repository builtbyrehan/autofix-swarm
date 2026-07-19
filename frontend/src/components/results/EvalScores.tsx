"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { HudPanel } from "@/components/ui";
import { mockEvalScores } from "@/lib/mockData";
import { formatRate } from "@/lib/format";
import type { EvalScores as EvalScoresType } from "@/types";

/**
 * EvalScores — evaluation metrics display with a bar chart.
 * Shows detection rate, fix success rate, and more.
 */

export function EvalScores() {
  // TODO: derive scores from live data when available
  const scores: EvalScoresType = mockEvalScores;

  const chartData = [
    { name: "Detection Rate", value: scores.detection_rate * 100, fill: "hsl(199, 89%, 48%)" },
    { name: "Fix Success Rate", value: scores.fix_success_rate * 100, fill: "hsl(173, 80%, 45%)" },
    { name: "Verified", value: (scores.verified_fixes_passed / Math.max(scores.bugs_planted, 1)) * 100, fill: "hsl(158, 64%, 45%)" },
  ];

  const statItems = [
    { label: "Bugs Planted", value: scores.bugs_planted },
    { label: "Bugs Found", value: scores.bugs_found },
    { label: "False Positives", value: scores.false_positive_count },
    { label: "Detection Rate", value: formatRate(scores.detection_rate) },
    { label: "Fix Success", value: formatRate(scores.fix_success_rate) },
    { label: "Verified Fixes", value: `${scores.verified_fixes_passed}/${scores.bugs_planted}` },
  ];

  return (
    <HudPanel brackets className="p-5">
      <p className="telemetry-label mb-4">Evaluation Scores</p>

      <div className="mb-6 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {statItems.map((item) => (
          <div key={item.label} className="text-center">
            <p className="text-lg font-bold tabular-nums text-foreground">
              {item.value}
            </p>
            <p className="telemetry-label text-[10px] leading-tight">
              {item.label}
            </p>
          </div>
        ))}
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 18%)" />
            <XAxis
              dataKey="name"
              tick={{ fill: "hsl(215 20% 65%)", fontSize: 11 }}
              axisLine={{ stroke: "hsl(217 33% 18%)" }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: "hsl(215 20% 65%)", fontSize: 10 }}
              axisLine={{ stroke: "hsl(217 33% 18%)" }}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(217 33% 11%)",
                border: "1px solid hsl(217 33% 18%)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: unknown) => [`${Number(value).toFixed(1)}%`]}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </HudPanel>
  );
}
