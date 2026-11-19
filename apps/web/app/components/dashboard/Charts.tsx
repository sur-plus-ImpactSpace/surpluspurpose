"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from "@/components/ui/chart";

/** Area chart over time: one series, month labels. */
export function TrendChart({
  config,
  data,
  dataKey
}: {
  config: ChartConfig;
  data: Array<Record<string, string | number | null>>;
  dataKey: string;
}) {
  return (
    <ChartContainer className="h-56 w-full" config={config}>
      <AreaChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
        <defs>
          <linearGradient id={`fill-${dataKey}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={`var(--color-${dataKey})`} stopOpacity={0.35} />
            <stop offset="100%" stopColor={`var(--color-${dataKey})`} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis axisLine={false} dataKey="label" interval="preserveStartEnd" tickLine={false} tickMargin={8} />
        <YAxis allowDecimals={false} axisLine={false} tickLine={false} width={28} />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} cursor={false} />
        <Area dataKey={dataKey} fill={`url(#fill-${dataKey})`} stroke={`var(--color-${dataKey})`} strokeWidth={2} type="monotone" />
      </AreaChart>
    </ChartContainer>
  );
}

/** Donut with a legend: slices by name. */
export function DonutChart({ slices }: { slices: Array<{ name: string; value: number }> }) {
  const config: ChartConfig = Object.fromEntries(
    slices.map((slice, index) => [slice.name, { label: slice.name, color: `var(--chart-${index + 1})` }])
  );
  const data = slices.map((slice) => ({ ...slice, fill: `var(--color-${slice.name})` }));

  return (
    <ChartContainer className="mx-auto h-56 w-full" config={config}>
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="name" />} />
        <Pie data={data} dataKey="value" innerRadius={52} nameKey="name" paddingAngle={2} strokeWidth={0}>
          {data.map((slice) => (
            <Cell fill={slice.fill} key={slice.name} />
          ))}
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="name" />} />
      </PieChart>
    </ChartContainer>
  );
}

/** Horizontal bars with a count each. */
export function BarsChart({ rows }: { rows: Array<{ count: number; label: string }> }) {
  const config: ChartConfig = { count: { label: "Count", color: "var(--chart-1)" } };

  return (
    <ChartContainer className="h-48 w-full" config={config}>
      <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 16 }}>
        <CartesianGrid horizontal={false} />
        <YAxis axisLine={false} dataKey="label" tickLine={false} type="category" width={80} />
        <XAxis allowDecimals={false} hide type="number" />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={false} />
        <Bar dataKey="count" fill="var(--color-count)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
