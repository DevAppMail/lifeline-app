import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Search, Stethoscope, Star, CheckCircle2,
  Heart, MapPin, Clock, Calendar, ArrowRight, UserRound,
} from "lucide-react";
import { useProfile } from "@/context/profile-context";

const CITY_STATE: Record<string, string> = {
  "mumbai": "maharashtra", "pune": "maharashtra", "nashik": "maharashtra", "nagpur": "maharashtra", "thane": "maharashtra", "aurangabad": "maharashtra",
  "delhi": "delhi", "new delhi": "delhi", "gurgaon": "haryana", "gurugram": "haryana", "noida": "uttar pradesh", "faridabad": "haryana",
  "bengaluru": "karnataka", "bangalore": "karnataka", "mysuru": "karnataka", "mysore": "karnataka", "hubli": "karnataka",
  "chennai": "tamil nadu", "coimbatore": "tamil nadu", "madurai": "tamil nadu", "trichy": "tamil nadu",
  "hyderabad": "telangana", "secunderabad": "telangana", "warangal": "telangana",
  "kolkata": "west bengal", "howrah": "west bengal", "durgapur": "west bengal",
  "ahmedabad": "gujarat", "surat": "gujarat", "vadodara": "gujarat", "rajkot": "gujarat",
  "jaipur": "rajasthan", "jodhpur": "rajasthan", "udaipur": "rajasthan",
  "lucknow": "uttar pradesh", "kanpur": "uttar pradesh", "agra": "uttar pradesh", "varanasi": "uttar pradesh",
  "chandigarh": "punjab", "amritsar": "punjab", "ludhiana": "punjab",
  "kochi": "kerala", "thiruvananthapuram": "kerala", "kozhikode": "kerala", "thrissur": "kerala",
  "bhopal": "madhya pradesh", "indore": "madhya pradesh",
  "patna": "bihar", "bhubaneswar": "odisha",
};

function proximityScore(docCity: string | null, userCity: string | null): number {
  if (!docCity || !userCity) return 2;
  const dc = docCity.toLowerCase().trim();
  const uc = userCity.toLowerCase().trim();
  if (dc === uc) return 0;
  const ds = CITY_STATE[dc]; const us = CITY_STATE[uc];
  if (ds && us && ds === us) return 1;
  return 2;
}

const SPECIALTIES = [
  "General Physician", "Cardiologist", "Dermatologist", "Gynaecologist",
  "Orthopaedic", "ENT", "Paediatrician", "Neurologist", "Psychiatrist",
  "Ophthalmologist", "Dentist",
];

type Doctor = {
  id: number; name: string; specialty: string; clinic_name: string | null;
  city: string | null; verification_status: string; rating: number | null;
  review_count: number | null; consultation_fee: number | null;
  available_days: string | null; available_start_time: string | null;
};

function initials(name: string) {
  return name.replace(/^Dr\.\s*/, "").split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");
}

function nextSlot(doc: Doctor): string {
  if (!doc.available_days || !doc.available_start_time) return "Check availability";
  const days = doc.available_days.split(",").map(d => d.trim());
  const today = new Date();
  for (let offset = 1; offset <= 7; offset++) {
    const d = new Date(today); d.setDate(today.getDate() + offset);
    const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
    if (days.some(day => day.toLowerCase().startsWith(dayName.toLowerCase()))) {
      const label = offset === 1 ? "Tomorrow" : d.toLocaleDateString("en-IN", { weekday: "long" });
      const [h, m] = (doc.available_start_time || "09:00").split(":");
      const hour = parseInt(h ?? "9");
      const suffix = hour >= 12 ? "PM" : "AM";
      const displayHour = hour > 12 ? hour - 12 : hour;
      return `${label} ${displayHour}:${m ?? "00"} ${suffix}`;
    }
  }
  return "Check availability";
}

function DoctorCard({ doc, onView, onBook }: { doc: Doctor; onView: () => void; onBook: () => void }) {
  const stars = Math.round(doc.rating ?? 4.5);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <span className="text-primary font-bold text-lg">{initials(doc.name)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-bold text-foreground text-sm leading-tight">{doc.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{doc.specialty}</p>
            </div>
            {doc.verification_status === "verified" && (
              <div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-full flex-shrink-0">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">NMC</span>
              </div>
            )}
          </div>
          {doc.clinic_name && (
            <div className="flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground truncate">{doc.clinic_name}{doc.city ? `, ${doc.city}` : ""}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={`w-3.5 h-3.5 ${i < stars ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"}`} />
          ))}
          <span className="text-xs text-muted-foreground ml-1">{doc.rating?.toFixed(1)} ({doc.review_count ?? 0})</span>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          <span>{nextSlot(doc)}</span>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button onClick={onView}
          className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors">
          View Profile
        </button>
        <button onClick={onBook}
          className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-primary/90 transition-colors">
          Book Now <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

function FavCard({ doc, onBook }: { doc: Doctor; onBook: () => void }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-3 flex-shrink-0 w-48 shadow-sm">
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <span className="text-primary font-bold text-sm">{initials(doc.name)}</span>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-foreground leading-tight truncate">{doc.name}</p>
          <p className="text-[10px] text-muted-foreground truncate">{doc.specialty}</p>
        </div>
      </div>
      {doc.clinic_name && <p className="text-[10px] text-muted-foreground mb-2.5 leading-tight truncate">{doc.clinic_name}</p>}
      <button onClick={onBook}
        className="w-full py-2 rounded-xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors">
        Book Again
      </button>
    </div>
  );
}

export default function BookDoctor() {
  const [, setLocation] = useLocation();
  const { profile } = useProfile();
  const [search, setSearch] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [defaultDoctors, setDefaultDoctors] = useState<Doctor[]>([]);
  const [favourites, setFavourites] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [defaultLoading, setDefaultLoading] = useState(true);
  const specialtyRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load favourites
  useEffect(() => {
    if (!profile?.phone) return;
    fetch(`/api/doctors/favourites?user_phone=${encodeURIComponent(profile.phone)}`)
      .then(r => r.json()).then(data => { if (Array.isArray(data)) setFavourites(data); })
      .catch(() => {});
  }, [profile?.phone]);

  // Load default doctors on mount — show 6, sorted nearest to user's city first
  useEffect(() => {
    setDefaultLoading(true);
    fetch("/api/doctors?verification_status=verified")
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) return;
        const userCity = profile?.city ?? null;
        const sorted = [...data].sort((a: Doctor, b: Doctor) =>
          proximityScore(a.city, userCity) - proximityScore(b.city, userCity)
        );
        setDefaultDoctors(sorted.slice(0, 6));
      })
      .catch(() => {})
      .finally(() => setDefaultLoading(false));
  }, [profile?.city]);

  // Search/specialty filter
  useEffect(() => {
    if (!search && !selectedSpecialty) { setDoctors([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (selectedSpecialty) params.set("specialty", selectedSpecialty);
        const res = await fetch(`/api/doctors?${params}`);
        const data = await res.json();
        setDoctors(Array.isArray(data) ? data : []);
      } catch { setDoctors([]); }
      setLoading(false);
    }, 300);
  }, [search, selectedSpecialty]);

  const handleSpecialty = (s: string) => {
    setSelectedSpecialty(prev => prev === s ? null : s);
    setSearch("");
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-3 px-4 pt-12 pb-4">
          <button onClick={() => setLocation("/home")}
            className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-lg text-foreground leading-tight">Book a Doctor</h1>
            <p className="text-xs text-muted-foreground">Find & book verified doctors near you</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        <div className="px-4 pt-5 space-y-6">

          <section>
            <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Heart className="w-4 h-4 text-primary" /> My Favourite Doctors
            </h2>
            {favourites.length === 0 ? (
              <div className="bg-muted/40 rounded-2xl p-5 text-center border border-border/50">
                <div className="w-12 h-12 rounded-2xl bg-muted mx-auto flex items-center justify-center mb-3">
                  <Heart className="w-5 h-5 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-semibold text-muted-foreground">No favourites yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1 leading-relaxed">Add doctors you visit often for quick booking.</p>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                {favourites.map(doc => (
                  <FavCard key={doc.id} doc={doc} onBook={() => setLocation(`/book-appointment/${doc.id}`)} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-primary" /> Find a Doctor
            </h2>

            <div className="relative mb-3">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name or symptom"
                value={search}
                onChange={e => { setSearch(e.target.value); setSelectedSpecialty(null); }}
                className="w-full pl-10 pr-4 py-3 bg-muted/50 border border-border rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>

            <div ref={specialtyRef} className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
              {SPECIALTIES.map(s => (
                <button key={s}
                  onClick={() => handleSpecialty(s)}
                  className={`flex-shrink-0 px-3.5 py-2 rounded-full text-xs font-semibold border transition-all ${
                    selectedSpecialty === s
                      ? "bg-primary text-white border-primary"
                      : "bg-muted/40 text-muted-foreground border-border/60 hover:border-primary/40"
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </section>

          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center py-10 gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <p className="text-sm text-muted-foreground">Finding doctors…</p>
              </motion.div>
            ) : doctors.length > 0 ? (
              <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="space-y-3">
                <p className="text-xs text-muted-foreground font-medium">{doctors.length} doctor{doctors.length !== 1 ? "s" : ""} found</p>
                {doctors.map(doc => (
                  <DoctorCard key={doc.id} doc={doc}
                    onView={() => setLocation(`/doctor/${doc.id}`)}
                    onBook={() => setLocation(`/book-appointment/${doc.id}`)} />
                ))}
              </motion.div>
            ) : (search || selectedSpecialty) ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center py-10 gap-3 text-center">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                  <UserRound className="w-6 h-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-semibold text-muted-foreground">No doctors found</p>
                <p className="text-xs text-muted-foreground/70">Try a different search or speciality</p>
              </motion.div>
            ) : defaultLoading ? (
              <motion.div key="defaultloading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center py-10 gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <p className="text-sm text-muted-foreground">Loading doctors near you…</p>
              </motion.div>
            ) : (
              <motion.div key="default" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="space-y-3">
                <p className="text-xs text-muted-foreground font-medium">
                  {profile?.city ? `Doctors near ${profile.city}` : "Verified doctors for you"}
                </p>
                {defaultDoctors.map(doc => (
                  <DoctorCard key={doc.id} doc={doc}
                    onView={() => setLocation(`/doctor/${doc.id}`)}
                    onBook={() => setLocation(`/book-appointment/${doc.id}`)} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
