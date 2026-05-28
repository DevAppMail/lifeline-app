import { useRef } from "react";
import { motion } from "framer-motion";
import { Heart, Download, Share2 } from "lucide-react";
import type { AppreciationCardData } from "@/types/contribution";

const FULFILLMENT_MESSAGES = [
  "Thank you for showing up when someone needed help.",
  "You chose to help someone today.",
  "Thank you for being a voluntary blood donor.",
];

const INDEPENDENT_MESSAGES = [
  "Thank you for choosing to donate blood.",
  "Your contribution may help save lives.",
  "Thank you for supporting voluntary blood donation.",
];

function getMessage(type: AppreciationCardData["type"]): string {
  const pool = type === "fulfillment" ? FULFILLMENT_MESSAGES : INDEPENDENT_MESSAGES;
  const hash = type === "fulfillment"
    ? Math.abs(hashStr("fulfillment")) % pool.length
    : Math.abs(hashStr("independent")) % pool.length;
  return pool[hash];
}

function hashStr(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function AppreciationCard({ data }: { data: AppreciationCardData }) {
  const message = getMessage(data.type);

  return (
    <div id={`appreciation-card-${data.cardId}`} className="relative">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-br from-primary/5 via-card to-primary/5 border-2 border-primary/20 rounded-3xl p-8 text-center max-w-sm mx-auto shadow-lg"
      >
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
          <Heart className="w-8 h-8 text-primary fill-primary/20" />
        </div>

        <h2 className="text-lg font-bold text-foreground mb-2">
          {data.donorName}
        </h2>

        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          {message}
        </p>

        <div className="border-t border-primary/10 pt-4 mt-4">
          <p className="text-xs text-muted-foreground">
            {formatDate(data.donationDate)}
          </p>
        </div>

        <div className="mt-5 pt-4 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground/60 font-medium tracking-widest uppercase">
            LifeLine — Voluntary Blood Donation
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export function AppreciationCardActions({
  onSave,
  onShare,
  onWhatsApp,
  cardId,
}: {
  onSave?: () => void;
  onShare?: () => void;
  onWhatsApp?: () => void;
  cardId: string;
}) {
  return (
    <div className="flex items-center justify-center gap-3 mt-4">
      {onSave && (
        <button
          onClick={onSave}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          <Download className="w-4 h-4" />
          Save
        </button>
      )}
      {onShare && (
        <button
          onClick={onShare}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          <Share2 className="w-4 h-4" />
          Share
        </button>
      )}
      {onWhatsApp && (
        <button
          onClick={onWhatsApp}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors"
        >
          <Share2 className="w-4 h-4" />
          WhatsApp
        </button>
      )}
    </div>
  );
}

export function useAppreciationCard() {
  const cardRef = useRef<HTMLDivElement>(null);

  async function saveCard(cardId: string) {
    const el = document.getElementById(`appreciation-card-${cardId}`);
    if (!el) return;
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(el, { backgroundColor: "#ffffff" });
      const link = document.createElement("a");
      link.download = `lifeline-appreciation-${cardId}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      // Fallback: screenshot not supported
    }
  }

  async function shareCard(cardId: string) {
    if (!navigator.share) return;
    const el = document.getElementById(`appreciation-card-${cardId}`);
    if (!el) return;
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(el, { backgroundColor: "#ffffff" });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `lifeline-appreciation-${cardId}.png`, { type: "image/png" });
      await navigator.share({
        title: "LifeLine Appreciation",
        text: "I donated blood through LifeLine",
        files: [file],
      });
    } catch {
      // User cancelled or share not supported
    }
  }

  function whatsAppShare(cardId: string) {
    const url = `https://wa.me/?text=${encodeURIComponent("I donated blood through LifeLine — voluntary blood donation.")}`;
    window.open(url, "_blank");
  }

  return { cardRef, saveCard, shareCard, whatsAppShare };
}
