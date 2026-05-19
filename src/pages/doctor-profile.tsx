import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { motion } from "framer-motion";
import {
  ChevronLeft, CheckCircle2, MapPin, Star, Heart,
  Languages, Calendar, Clock,
} from "lucide-react";
import { useProfile } from "@/context/profile-context";

type Doctor = {
  id: number; name: string; specialty: string; nmc_number: string;
  verification_status: string; clinic_name: string | null; clinic_address: string | null;
  city: string | null; consultation_fee: number | null; rating: number | null;
  review_count: number | null; languages: string | null; about: string | null;
  available_days: string | null; available_start_time: string | null; available_end_time: string | null;
};

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function initials(name: string) {
  return name.replace(/^Dr\.\s*/, "").split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");
}

function formatTime(t: string): string {
  const [h, m] = t.split(":");
  const hour = parseInt(h ?? "9");
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m ?? "00"} ${suffix}`;
}

export default function DoctorProfile() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/doctor/:id");
  const { profile } = useProfile();
  const [doc, setDoc] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFav, setIsFav] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  const doctorId = Number(params?.id);

  useEffect(() => {
    if (isNaN(doctorId)) return;
    setLoading(true);
    fetch(`/api/doctors/${doctorId}`)
      .then(r => r.json()).then(data => { setDoc(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [doctorId]);

  useEffect(() => {
    if (!profile?.phone || isNaN(doctorId)) return;
    fetch(`/api/doctors/favourites?user_phone=${encodeURIComponent(profile.phone)}`)
      .then(r => r.json())
      .then((data: Doctor[]) => { if (Array.isArray(data)) setIsFav(data.some(d => d.id === doctorId)); })
      .catch(() => {});
  }, [profile?.phone, doctorId]);

  const toggleFav = async () => {
    if (!profile?.phone || !doc) return;
    setFavLoading(true);
    try {
      if (isFav) {
        await fetch(`/api/doctors/favourites/${doc.id}?user_phone=${encodeURIComponent(profile.phone)}`, { method: "DELETE" });
        setIsFav(false);
      } else {
        await fetch("/api/doctors/favourites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_phone: profile.phone, doctor_id: doc.id }),
        });
        setIsFav(true);
      }
    } catch {}
    setFavLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-muted-foreground font-medium">Doctor not found</p>
        <button onClick={() => setLocation("/book-doctor")} className="text-primary text-sm font-semibold">Go back</button>
      </div>
    );
  }

  const availDays = doc.available_days ? doc.available_days.split(",").map(d => d.trim()) : [];
  const stars = Math.round(doc.rating ?? 4.5);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 pt-12 pb-4">
          <button onClick={() => setLocation("/book-doctor")}
            className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={toggleFav} disabled={favLoading}
            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors ${
              isFav ? "bg-primary border-primary text-white" : "border-border bg-card text-muted-foreground hover:border-primary/50"
            }`}>
            <Heart className={`w-4.5 h-4.5 ${isFav ? "fill-current" : ""}`} style={{ width: 18, height: 18 }} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-28">
        <div className="px-4 space-y-5">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center text-center pt-2 pb-4">
            <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center mb-4 shadow-sm">
              <span className="text-primary font-bold text-3xl">{initials(doc.name)}</span>
            </div>
            <h1 className="text-xl font-bold text-foreground leading-tight">{doc.name}</h1>
            <p className="text-muted-foreground text-sm mt-1">{doc.specialty}</p>

            <div className="flex items-center gap-3 mt-3 flex-wrap justify-center">
              {doc.verification_status === "verified" && (
                <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">NMC Verified</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`w-4 h-4 ${i < stars ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"}`} />
                ))}
                <span className="text-sm text-muted-foreground ml-1">{doc.rating?.toFixed(1)} ({doc.review_count ?? 0} reviews)</span>
              </div>
            </div>

            {doc.verification_status === "verified" && (
              <p className="text-[11px] text-muted-foreground/60 mt-2">Reg. No: {doc.nmc_number}</p>
            )}
          </motion.div>

          {(doc.clinic_name || doc.clinic_address) && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MapPin className="w-4.5 h-4.5 text-primary" style={{ width: 18, height: 18 }} />
                </div>
                <div className="flex-1 min-w-0">
                  {doc.clinic_name && <p className="font-semibold text-sm text-foreground">{doc.clinic_name}</p>}
                  {doc.clinic_address && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{doc.clinic_address}</p>}
                  {doc.city && <p className="text-xs text-muted-foreground/70 mt-0.5">{doc.city}</p>}
                </div>
                <a
                  href={`https://www.google.com/maps/search/${encodeURIComponent([doc.clinic_name, doc.city].filter(Boolean).join(", "))}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex-shrink-0 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-semibold hover:bg-primary/20 transition-colors">
                  Maps
                </a>
              </div>
            </motion.div>
          )}

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Languages className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Languages</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                {doc.languages ? doc.languages.split(",").map(l => l.trim()).join(", ") : "English, Hindi"}
              </p>
            </div>
          </motion.div>

          {doc.about && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
              className="bg-card border border-border rounded-2xl p-4">
              <h3 className="text-sm font-bold text-foreground mb-2">About</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{doc.about}</p>
            </motion.div>
          )}

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}
            className="bg-card border border-border rounded-2xl p-4">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" /> Availability
            </h3>
            <div className="flex gap-2 flex-wrap mb-4">
              {ALL_DAYS.map(day => {
                const avail = availDays.some(d => d.toLowerCase().startsWith(day.toLowerCase()));
                return (
                  <div key={day}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      avail
                        ? "bg-primary/10 text-primary border-primary/20"
                        : "bg-muted/30 text-muted-foreground/40 border-border/30"
                    }`}>
                    {day}
                  </div>
                );
              })}
            </div>
            {doc.available_start_time && doc.available_end_time && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{formatTime(doc.available_start_time)} – {formatTime(doc.available_end_time)}</span>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-4 pb-6 pt-3 bg-background/95 backdrop-blur-sm border-t border-border" style={{ zIndex: 10 }}>
        <button onClick={() => setLocation(`/book-appointment/${doc.id}`)}
          className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-primary/25 hover:bg-primary/90 transition-colors">
          <Calendar className="w-5 h-5" />
          Book Appointment
        </button>
      </div>
    </div>
  );
}
