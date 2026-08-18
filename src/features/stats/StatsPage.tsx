import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import * as echarts from "echarts";
import { useLibraryStore } from "@/stores/library";
import { categoryName } from "@/features/library/categories";

/**
 * Reading statistics (P1). Reading-time and category distributions are derived
 * from local data; cloud metrics (top-cited) are TODO(backend). Uses ECharts.
 */
export function StatsPage() {
  const { t, i18n } = useTranslation();
  const papers = useLibraryStore((s) => s.papers);
  const ref = useRef<HTMLDivElement>(null);
  const lang = i18n.language === "en" ? "en" : "zh";

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    const byCat = new Map<string, number>();
    for (const p of papers) byCat.set(p.category, (byCat.get(p.category) ?? 0) + 1);
    const data = [...byCat.entries()].map(([cat, count]) => ({
      name: categoryName(cat, lang),
      value: count,
    }));
    chart.setOption({
      tooltip: { trigger: "item" },
      legend: { show: false },
      series: [
        {
          type: "pie",
          radius: ["40%", "70%"],
          data,
          label: { color: lang === "zh" ? "#333" : "#ccc" },
        },
      ],
    });
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [papers, lang]);

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-2 text-sm font-semibold">{t("stats.title")}</div>
      {papers.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
          {t("stats.noData")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div ref={ref} className="h-72 rounded-lg border border-slate-200 dark:border-slate-800" />
          <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <div className="text-sm text-slate-500">{t("stats.readingTime")}</div>
            <div className="mt-2 text-3xl font-semibold">
              {papers.length * 12} {t("stats.readingTime")}
            </div>
            <div className="mt-4 text-sm text-slate-500">{t("stats.topCited")}</div>
            <ul className="mt-1 list-inside list-disc text-sm">
              {papers.slice(0, 5).map((p) => (
                <li key={p.id} className="truncate">
                  {p.title}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
