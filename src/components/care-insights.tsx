import { useMemo } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Heart, Clock, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { getAllCareInsights, getProviderVisitStats } from "@/lib/continuity-intelligence";
import type { CareInsight } from "@/lib/continuity-intelligence";

const INSIGHT_ICONS: Record<string, React.ReactNode> = {
  care_gap: <Clock className="w-4 h-4" />,
  missed_follow_up: <AlertCircle className="w-4 h-4" />,
  medication_adherence: <CheckCircle2 className="w-4 h-4" />,
  recurring_provider: <Heart className="w-4 h-4" />,
  follow_up_completion: <CheckCircle2 className="w-4 h-4" />,
  upcoming_continuity: <Clock className="w-4 h-4" />,
};

const INSIGHT_STYLES: Record<string, { bg: string; iconBg: string; border: string }> = {
  positive: { bg: "bg-emerald-50 dark:bg-emerald-950/20", iconBg: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800/30" },
  info: { bg: "bg-blue-50 dark:bg-blue-950/20", iconBg: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400", border: "border-blue-200 dark:border-blue-800/30" },
  gentle: { bg: "bg-amber-50 dark:bg-amber-950/20", iconBg: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800/30" },
  attention: { bg: "bg-rose-50 dark:bg-rose-950/20", iconBg: "bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400", border: "border-rose-200 dark:border-rose-800/30" },
};

function InsightCard({ insight }: { insight: CareInsight }) {
  const style = INSIGHT_STYLES[insight.severity] ?? INSIGHT_STYLES.info;
  const icon = INSIGHT_ICONS[insight.type] ?? <Info className="w-4 h-4" />;
  const inner = (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl p-3.5 border ${style.bg} ${style.border}`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${style.iconBg}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{insight.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{insight.description}</p>
        </div>
      </div>
    </motion.div>
  );
  if (insight.actionable && insight.actionRoute) {
    return <Link href={insight.actionRoute} className="block">{inner}</Link>;
  }
  return inner;
}

export function CareInsightsWidget({ limit = 2 }: { limit?: number }) {
  const insights = useMemo(() => getAllCareInsights(), []);
  const visible = insights.slice(0, limit);

  if (visible.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-foreground">Care Insights</h2>
        {insights.length > limit && (
          <Link href="/health" className="text-xs font-semibold text-primary">View all</Link>
        )}
      </div>
      <div className="space-y-2.5">
        {visible.map((insight) => (
          <InsightCard key={`${insight.type}-${insight.timestamp}`} insight={insight} />
        ))}
      </div>
    </section>
  );
}

export function ProviderContinuitySummary() {
  const stats = useMemo(() => getProviderVisitStats(), []);
  const trusted = stats.filter(s => s.totalVisits >= 3).slice(0, 3);

  if (trusted.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-foreground">My Care Team</h2>
        <Link href="/providers" className="text-xs font-semibold text-primary">Manage</Link>
      </div>
      <div className="space-y-2.5">
        {trusted.map((provider, i) => (
          <motion.div key={provider.name} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-2xl p-3.5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                {provider.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{provider.name}</p>
                <p className="text-xs text-muted-foreground">
                  {provider.totalVisits} visit{provider.totalVisits !== 1 ? "s" : ""}
                  {provider.lastVisit ? ` · Last: ${new Date(provider.lastVisit).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}
                  {provider.hasFollowUp ? " · Active follow-up" : ""}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
