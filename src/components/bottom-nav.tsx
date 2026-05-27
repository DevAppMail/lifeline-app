import { useLocation, Link } from "wouter";
import { useState, useEffect } from "react";
import { Heart, Droplet, Activity, User, Bell } from "lucide-react";
import { getUnreadCount } from "@/lib/reminder-store";

interface NavTab {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeKey?: "requests" | "notifications";
}

const TABS: NavTab[] = [
  { href: "/home", label: "Home", icon: Heart },
  { href: "/donate", label: "Donate", icon: Droplet },
  { href: "/requests", label: "Requests", icon: Activity, badgeKey: "requests" },
  { href: "/notifications", label: "Notifications", icon: Bell, badgeKey: "notifications" },
  { href: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const [location] = useLocation();
  const [notifCount, setNotifCount] = useState(0);
  const [requestsBadge, setRequestsBadge] = useState(0);

  useEffect(() => {
    setNotifCount(getUnreadCount());
    try {
      const seen = JSON.parse(localStorage.getItem("lifeline_requests_seen_ids") ?? "[]") as string[];
      const store = JSON.parse(localStorage.getItem("lifeline_request_store") ?? "{}") as { requests?: unknown[] };
      const total = Array.isArray(store.requests) ? store.requests.length : 0;
      setRequestsBadge(Math.max(0, total - seen.length));
    } catch {
      setRequestsBadge(0);
    }
    const onFocus = () => setNotifCount(getUnreadCount());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [location]);

  return (
    <>
      <nav className="fixed bottom-0 w-full max-w-[430px] bg-card/95 backdrop-blur-md border-t border-border flex justify-around py-3 pb-safe z-50">
        {TABS.map(({ href, label, icon: Icon, badgeKey }) => {
          const isActive = location === href || location.startsWith(href + "/");
          const count = badgeKey === "notifications" ? notifCount : badgeKey === "requests" ? requestsBadge : 0;
          return (
            <Link key={href} href={href}
              className={`flex flex-col items-center gap-1 relative ${isActive ? "text-primary" : "text-muted-foreground"}`}>
              <Icon className={`w-5 h-5 ${isActive && href === "/home" ? "fill-primary" : ""} ${isActive ? "text-primary" : "text-muted-foreground"}`} />
              {count > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                  {count > 99 ? "99+" : count}
                </span>
              )}
              <span className={`text-[10px] ${isActive ? "font-semibold" : "font-medium"}`}>{label}</span>
            </Link>
          );
        })}
      </nav>
      <style>{`.pb-safe { padding-bottom: calc(0.75rem + env(safe-area-inset-bottom)); }`}</style>
    </>
  );
}
