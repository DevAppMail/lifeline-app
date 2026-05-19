import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { CheckCircle2, Calendar, Clock, MapPin, Navigation, CalendarPlus, Home } from "lucide-react";

export default function BookingConfirmed() {
  const [, setLocation] = useLocation();
  const [params, setParams] = useState<Record<string, string>>({});

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const p: Record<string, string> = {};
    searchParams.forEach((v, k) => { p[k] = v; });
    setParams(p);
  }, []);

  const { bookingId, doctorName, date, time, clinic, city } = params;

  const formattedDate = date
    ? new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";

  const handleAddCalendar = () => {
    if (!date || !time || !doctorName) return;
    const startStr = date.replace(/-/g, "") + "T" + (time?.replace(/\s/g, "").replace(/:/g, "").padEnd(6, "0") ?? "090000");
    const calUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=Doctor+Appointment+with+${encodeURIComponent(doctorName ?? "")}&dates=${startStr}/${startStr}&details=Booked+via+LifeLine+(${bookingId ?? ""})&location=${encodeURIComponent(clinic ?? "")}`;
    window.open(calUrl, "_blank");
  };

  const handleDirections = () => {
    const query = [clinic, city].filter(Boolean).join(", ");
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`, "_blank");
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <div className="flex-1 flex flex-col items-center justify-start pt-16 px-5">

        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 18 }}
          className="w-24 h-24 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/10">
          <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="text-center mb-2">
          <h1 className="text-2xl font-bold text-foreground">Booking Confirmed!</h1>
          <p className="text-muted-foreground text-sm mt-2 leading-relaxed max-w-[280px]">
            Your appointment has been successfully booked. See you there!
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="w-full mt-2 mb-2">
          <div className="bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3 text-center">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest mb-1">Booking ID</p>
            <p className="text-2xl font-bold text-primary tracking-widest">{bookingId ?? "—"}</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="w-full bg-card border border-border rounded-2xl p-4 space-y-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-primary font-bold text-sm">
                {(doctorName ?? "").replace(/^Dr\.\s*/, "").split(" ").slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? "").join("")}
              </span>
            </div>
            <div>
              <p className="font-bold text-sm text-foreground">{doctorName ?? "—"}</p>
              {(clinic || city) && (
                <p className="text-xs text-muted-foreground">{[clinic, city].filter(Boolean).join(", ")}</p>
              )}
            </div>
          </div>

          <div className="h-px bg-border" />

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground font-medium">Date</p>
                <p className="text-xs font-semibold text-foreground">{formattedDate}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary flex-shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground font-medium">Time</p>
                <p className="text-xs font-semibold text-foreground">{time ?? "—"}</p>
              </div>
            </div>
          </div>

          {(clinic || city) && (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground font-medium">Location</p>
                <p className="text-xs font-semibold text-foreground">{[clinic, city].filter(Boolean).join(", ")}</p>
              </div>
            </div>
          )}

        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="w-full grid grid-cols-2 gap-3 mb-4">
          <button onClick={handleDirections}
            className="py-3.5 rounded-xl border border-border bg-card flex items-center justify-center gap-2 text-sm font-semibold text-foreground hover:border-primary/40 transition-colors">
            <Navigation className="w-4 h-4 text-primary" /> Directions
          </button>
          <button onClick={handleAddCalendar}
            className="py-3.5 rounded-xl border border-border bg-card flex items-center justify-center gap-2 text-sm font-semibold text-foreground hover:border-primary/40 transition-colors">
            <CalendarPlus className="w-4 h-4 text-primary" /> Add to Cal
          </button>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="w-full">
          <button onClick={() => setLocation("/home")}
            className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-primary/25 hover:bg-primary/90 transition-colors">
            <Home className="w-5 h-5" /> Back to Home
          </button>
        </motion.div>
      </div>
    </div>
  );
}
