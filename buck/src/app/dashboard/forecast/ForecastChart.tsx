"use client";

import { useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type TooltipItem,
} from "chart.js";
import { useAuthPageTheme } from "@/hooks/useAuthPageTheme";
import { buckChartColors, buckTooltip } from "@/utils/chartTheme";
import type { BuckForecast } from "@/utils/forecastApi";
import { formatLongDate, formatShortDate } from "@/utils/forecastDisplay";
import { formatCurrency } from "@/utils/formatters";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

type ChartMode = "daily" | "cumulative";

const ORANGE = "#f47536";
// Dataset order: 0 = P90 (fills down to 1), 1 = P10, 2 = P50, 3 = attitude target.
const P10_INDEX = 1;

/**
 * Daily (or cumulative) forecast: the P10–P90 band shaded, the likely P50
 * line, a dashed saving-attitude target, and a marker on days with recurring
 * items. Everything is a dataset, so theme changes apply through `options`.
 */
export default function ForecastChart({ forecast }: { forecast: BuckForecast }) {
  const isDarkTheme = useAuthPageTheme();
  const [mode, setMode] = useState<ChartMode>("daily");
  const { text: textColor, grid: gridColor } = buckChartColors(isDarkTheme);
  const targetColor = isDarkTheme ? "#ffc547" : "#b8860b";
  const markerColor = isDarkTheme ? "#ffc547" : "#c98a00";
  const bandFill = isDarkTheme ? "rgba(244, 117, 54, 0.2)" : "rgba(244, 117, 54, 0.14)";

  const { days, target } = forecast;
  const cumulative = mode === "cumulative";
  const showTarget = target.multiplier !== 1;
  const pick = (key: "p10" | "p50" | "p90") =>
    days.map((d) => (cumulative ? d.cumulative[key] : d[key]));
  const targetValues = days.map((_, i) => (cumulative ? target.dailyTarget * (i + 1) : target.dailyTarget));
  const hasRecurring = days.map((d) => d.recurring.length > 0);

  const datasets = [
    {
      label: "Range",
      data: pick("p90"),
      borderWidth: 0,
      pointRadius: 0,
      pointHoverRadius: 0,
      backgroundColor: bandFill,
      fill: "+1",
      tension: 0.3,
    },
    {
      label: "Low",
      data: pick("p10"),
      borderWidth: 0,
      pointRadius: 0,
      pointHoverRadius: 0,
      fill: false,
      tension: 0.3,
    },
    {
      label: "Likely",
      data: pick("p50"),
      borderColor: ORANGE,
      borderWidth: 2.5,
      backgroundColor: ORANGE,
      pointRadius: hasRecurring.map((r) => (r ? 5 : 0)),
      pointHoverRadius: hasRecurring.map((r) => (r ? 7 : 4)),
      pointStyle: hasRecurring.map((r) => (r ? "rectRot" : "circle")),
      pointBackgroundColor: hasRecurring.map((r) => (r ? markerColor : ORANGE)),
      pointBorderColor: hasRecurring.map((r) => (r ? markerColor : ORANGE)),
      fill: false,
      tension: 0.3,
    },
    ...(showTarget
      ? [
          {
            label: "Attitude target",
            data: targetValues,
            borderColor: targetColor,
            borderWidth: 1.5,
            borderDash: [6, 4],
            pointRadius: 0,
            pointHoverRadius: 0,
            fill: false,
            tension: 0,
          },
        ]
      : []),
  ];

  const label = (ctx: TooltipItem<"line">) => {
    const day = days[ctx.dataIndex];
    const band = cumulative ? day.cumulative : day;
    if (ctx.datasetIndex === 0) {
      return `80% range: ${formatCurrency(band.p10)} – ${formatCurrency(band.p90)}`;
    }
    if (ctx.datasetIndex === 2) return `Likely: ${formatCurrency(band.p50)}`;
    return `${target.attitude} target: ${formatCurrency(Number(ctx.raw))}`;
  };

  return (
    <div className="forecast-chart-block">
      <div className="forecast-chart-toolbar">
        <div className="forecast-legend" aria-hidden="true">
          <span><i className="forecast-legend-swatch forecast-legend-swatch--line" />Likely</span>
          <span><i className="forecast-legend-swatch forecast-legend-swatch--band" />80% range</span>
          {showTarget && (
            <span><i className="forecast-legend-swatch forecast-legend-swatch--target" />{target.attitude} target</span>
          )}
          {hasRecurring.some(Boolean) && (
            <span><i className="forecast-legend-swatch forecast-legend-swatch--marker" />Recurring</span>
          )}
        </div>
        <div className="forecast-segmented" role="group" aria-label="Chart view">
          {(["daily", "cumulative"] as const).map((m) => (
            <button
              key={m}
              type="button"
              className="forecast-segmented-btn"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
            >
              {m === "daily" ? "Daily" : "Cumulative"}
            </button>
          ))}
        </div>
      </div>

      <div className="forecast-chart">
        <Line
          aria-label={`${cumulative ? "Cumulative" : "Daily"} spending forecast for the next ${days.length} days`}
          role="img"
          data={{ labels: days.map((d) => formatShortDate(d.date)), datasets }}
          options={{
            maintainAspectRatio: false,
            animation: { duration: 300 },
            interaction: { mode: "index", intersect: false },
            layout: { padding: { top: 8, right: 4, left: 0, bottom: 0 } },
            plugins: {
              legend: { display: false },
              tooltip: {
                ...buckTooltip(isDarkTheme),
                filter: (item) => item.datasetIndex !== P10_INDEX,
                itemSort: (a, b) => {
                  const order = [1, 9, 0, 2];
                  return order[a.datasetIndex] - order[b.datasetIndex];
                },
                callbacks: {
                  title: (items) => formatLongDate(days[items[0]?.dataIndex ?? 0]?.date),
                  label,
                  labelColor: (ctx) => {
                    const color =
                      ctx.datasetIndex === 0 ? "rgba(244, 117, 54, 0.45)" : ctx.datasetIndex === 2 ? ORANGE : targetColor;
                    return { borderColor: color, backgroundColor: color, borderWidth: 1, borderRadius: 2 };
                  },
                  footer: (items) => {
                    const recurring = days[items[0]?.dataIndex ?? 0]?.recurring ?? [];
                    return recurring.length ? ["Recurring:", ...recurring.map((r) => `• ${r}`)] : [];
                  },
                },
              },
            },
            scales: {
              x: {
                grid: { display: false },
                border: { color: gridColor },
                ticks: { color: textColor, font: { weight: 600, size: 11.5 }, maxRotation: 0, autoSkipPadding: 14 },
              },
              y: {
                beginAtZero: true,
                border: { display: false },
                grid: { color: gridColor },
                ticks: {
                  color: textColor,
                  font: { size: 11.5 },
                  maxTicksLimit: 6,
                  callback: (v) => `₱${Number(v).toLocaleString("en-US")}`,
                },
              },
            },
          }}
        />
      </div>
    </div>
  );
}
