import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Droplet, Clock, AlertTriangle } from "lucide-react";
import { getCommitments } from "@/lib/commitments";
import type { Commitment } from "@/lib/commitments";

export function CommitmentStrip() {
  const [active, setActive] = useState<Commitment | null>(null);
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    const commitments = getCommitments();
    const active = commitments.find(c => c.status === "committed" || c.status === "awaiting_confirmation");
    setActive(active ?? null);
  }, []);

  useEffect(() => {
    if (!active?.requiredDate) return;
    const target = new Date(`${active.requiredDate}T${active.requiredTime || "09:00"}`);
    const update = () => {
      const diff = target.getTime() - Date.now();
      if (diff <= 0) { setRemaining("Due now"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setRemaining(h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [active?.requiredDate, active?.requiredTime]);

  if (!active) return null;

  const isUrgent = active.requiredDate && new Date(`${active.requiredDate}T${active.requiredTime || "09:00"}`).getTime() - Date.now() < 7200000;

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      className={`mx-4 mt-3 rounded-2xl p-3 border ${
        isUrgent
          ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/40"
          : "bg-primary/5 border-primary/20"
      }`}>
      <Link href="/donate" className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isUrgent ? "bg-red-100 dark:bg-red-900/30" : "bg-primary/10"
        }`}>
          {isUrgent
            ? <AlertTriangle className="w-4.5 h-4.5 text-red-600 dark:text-red-400" style={{ width: 18, height: 18 }} />
            : <Droplet className="w-4.5 h-4.5 text-primary" style={{ width: 18, height: 18 }} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-foreground">Blood donation commitment</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {active.hospitalName}{active.hospitalLocation ? ` · ${active.hospitalLocation}` : ""} {remaining ? ` · ${remaining}` : ""}
          </p>
        </div>
        <div className={`text-xs font-bold flex items-center gap-1 flex-shrink-0 ${
          isUrgent ? "text-red-600 dark:text-red-400" : "text-primary"
        }`}>
          <Clock className="w-3 h-3" />
          {remaining}
        </div>
      </Link>
    </motion.div>
  );
}
