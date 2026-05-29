import { useLocation, Link } from "wouter";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useBreadcrumb } from "@/hooks/useBreadcrumb";

export function BreadcrumbBar() {
  const [location] = useLocation();
  const { backLabel, backPath, section } = useBreadcrumb();

  // Hide breadcrumb on auth/onboarding/root pages
  const hideOnPaths = ["/login", "/onboarding", "/auth/callback", "/"];
  if (hideOnPaths.includes(location) || location === "/") {
    return null;
  }

  // Only show breadcrumb on child pages (pages that have a parent)
  if (!backLabel || !backPath) return null;

  return (
    <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
      <div className="px-4 py-2.5">
        <Link
          href={backPath}
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ChevronLeft className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          <span>Back to {backLabel}</span>
        </Link>
      </div>
    </div>
  );
}

// ── Full breadcrumb trail (for deeper hierarchies) ───────────────────
// Usage: <BreadcrumbTrail /> — shows "Section > Parent > Current"

export function BreadcrumbTrail() {
  const { segments, currentLabel } = useBreadcrumb();

  if (segments.length === 0) return null;

  return (
    <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
      <div className="px-4 py-2.5 flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap scrollbar-none">
        {segments.map((seg, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />}
            <Link
              href={seg.path}
              className="text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              {seg.label}
            </Link>
          </span>
        ))}
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
        <span className="text-foreground font-semibold">{currentLabel}</span>
      </div>
    </div>
  );
}
