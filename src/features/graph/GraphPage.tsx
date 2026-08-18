import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import * as echarts from "echarts";
import { useLibraryStore } from "@/stores/library";

/**
 * Citation graph (P0). Renders an ECharts force-directed graph of the
 * library's papers and their citation relationships. Edge data currently comes
 * from the server `/api/citations` (TODO(backend)); until then we render the
 * paper nodes with synthetic links so the interaction is demonstrable.
 */
export function GraphPage() {
  const { t } = useTranslation();
  const papers = useLibraryStore((s) => s.papers);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    const nodes = papers.slice(0, 40).map((p, i) => ({
      id: p.id,
      name: p.title.slice(0, 24),
      symbolSize: 14 + (p.latestVersion ?? 1),
      value: i,
    }));
    const links = papers.slice(0, 40).map((p, i) => ({
      source: p.id,
      target: papers[(i + 1) % papers.length]?.id ?? p.id,
    }));
    chart.setOption({
      tooltip: {},
      series: [
        {
          type: "graph",
          layout: "force",
          roam: true,
          label: { show: false },
          data: nodes,
          links,
          force: { repulsion: 120, edgeLength: 80 },
        },
      ],
    });
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [papers]);

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-2 text-sm text-slate-500">{t("graph.title")}</div>
      {papers.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
          {t("graph.empty")}
        </div>
      ) : (
        <div ref={ref} className="min-h-0 flex-1 rounded-lg border border-slate-200 dark:border-slate-800" />
      )}
    </div>
  );
}
