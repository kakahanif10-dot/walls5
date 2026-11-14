"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  INSTITUTIONAL_TOOL_SPECS,
  WORKFLOW_COMPARISON_MATRIX,
  type InstitutionalToolSlug,
} from "@/lib/institutional-tools-data";

export default function WorkflowMatrix({
  activeSlug,
  isLight = false,
}: {
  activeSlug?: InstitutionalToolSlug;
  isLight?: boolean;
}) {
  const [stackFilter, setStackFilter] = useState<"all" | "traditional" | "digital">("all");

  const surface = isLight
    ? "bg-white border-slate-200 text-slate-900"
    : "bg-zinc-950/75 border-zinc-800 text-zinc-100";
  const subText = isLight ? "text-slate-600" : "text-zinc-400";
  const borderHair = isLight ? "border-slate-200" : "border-zinc-800/80";
  const rowHover = isLight ? "hover:bg-slate-50" : "hover:bg-zinc-900/60";
  const segWrap = isLight ? "bg-slate-100 border-slate-200" : "bg-zinc-900 border-zinc-800";

  const filteredTools = INSTITUTIONAL_TOOL_SPECS.filter(
    (t) => stackFilter === "all" || t.stack === stackFilter,
  );

  return (
    <section className={`rounded-2xl border p-5 space-y-5 ${surface}`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight">
            How Institutional Workflows Compare
          </h3>
          <p className={`text-xs mt-1 ${subText}`}>
            Traditional Wall Street Stack vs. Digital Asset &amp; On-Chain Research Stack across all{" "}
            {INSTITUTIONAL_TOOL_SPECS.length} specialized desks.
          </p>
        </div>

        <div className={`inline-flex items-center gap-1 rounded-lg border p-1 self-start ${segWrap}`}>
          {(
            [
              { id: "all", label: "Side-by-Side" },
              {
                id: "traditional",
                label: `Traditional (${INSTITUTIONAL_TOOL_SPECS.filter((t) => t.stack === "traditional").length})`,
              },
              {
                id: "digital",
                label: `Digital Asset (${INSTITUTIONAL_TOOL_SPECS.filter((t) => t.stack === "digital").length})`,
              },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setStackFilter(opt.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                stackFilter === opt.id
                  ? isLight
                    ? "bg-white text-slate-900 shadow-sm"
                    : "bg-zinc-800 text-white"
                  : subText
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Comparison Matrix Table */}
      <div className={`overflow-x-auto rounded-xl border ${borderHair}`}>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className={`border-b ${borderHair} ${isLight ? "bg-slate-50" : "bg-zinc-900/80"}`}>
              <th className="py-3 px-4 font-semibold w-44">Focus Area</th>
              {stackFilter !== "digital" && (
                <th className="py-3 px-4 font-semibold">Traditional Wall Street Stack</th>
              )}
              {stackFilter !== "traditional" && (
                <th className="py-3 px-4 font-semibold">Digital Asset &amp; Crypto Stack</th>
              )}
            </tr>
          </thead>
          <tbody className={`divide-y ${borderHair}`}>
            {WORKFLOW_COMPARISON_MATRIX.map((row) => (
              <tr key={row.focusArea} className={`transition-colors ${rowHover}`}>
                <td className="py-3 px-4 font-medium whitespace-nowrap">{row.focusArea}</td>
                {stackFilter !== "digital" && (
                  <td className={`py-3 px-4 leading-relaxed ${subText}`}>
                    {row.traditionalWallStreet}
                  </td>
                )}
                {stackFilter !== "traditional" && (
                  <td className={`py-3 px-4 leading-relaxed ${subText}`}>
                    {row.digitalAssetCrypto}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Quick Navigation Across All 11 Desks */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredTools.map((tool) => {
          const isCurrent = tool.slug === activeSlug;
          return (
            <Link
              key={tool.slug}
              href={tool.href}
              className={`group flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-xs transition-colors ${
                isCurrent
                  ? isLight
                    ? "border-emerald-600 bg-emerald-50/70 text-emerald-950 font-semibold"
                    : "border-emerald-500/60 bg-emerald-500/10 text-emerald-200 font-semibold"
                  : isLight
                    ? "border-slate-200 hover:border-slate-300 bg-slate-50/60 text-slate-800"
                    : "border-zinc-800 hover:border-zinc-700 bg-zinc-900/50 text-zinc-200"
              }`}
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{tool.label}</div>
                <div className={`truncate text-[11px] mt-0.5 ${subText}`}>
                  {tool.stack === "traditional" ? "Traditional" : "Digital Asset"} · {tool.equivalentPlatforms}
                </div>
              </div>
              <ArrowUpRight className={`h-3.5 w-3.5 shrink-0 ${subText}`} aria-hidden="true" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
