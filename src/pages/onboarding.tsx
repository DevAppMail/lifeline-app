import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ChevronLeft, Droplet, Info, HelpCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile, BloodGroup } from "@/context/profile-context";
import { supabase } from "@/lib/supabase";

const BLOOD_GROUPS: BloodGroup[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const YEARS = Array.from({ length: 10 }, (_, i) => String(new Date().getFullYear() - i));

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { setProfile, updateProfile } = useProfile();
  const [registering, setRegistering] = useState(false);

  const [step, setStep] = useState(1);

  // Screen 1
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other" | "">("");
  const [age, setAge] = useState<string>("");
  const [city, setCity] = useState("");
  const [workLocation, setWorkLocation] = useState("");
  const [showTooltip, setShowTooltip] = useState(false);

  // Screen 2
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | "">("");
  const [bloodGroupUnknown, setBloodGroupUnknown] = useState(false);
  const [donatedBefore, setDonatedBefore] = useState<boolean | null>(null);
  const [hasHealthIssues, setHasHealthIssues] = useState<boolean | null>(null);
  // Last donation month/year (when donatedBefore = true)
  const [lastDonationMonth, setLastDonationMonth] = useState("");
  const [lastDonationYear, setLastDonationYear] = useState("");

  const isStep1Valid =
    name.trim().length >= 2 &&
    gender !== "" &&
    age !== "" &&
    Number(age) >= 1 &&
    Number(age) <= 120 &&
    city.trim().length >= 2;

  const bloodGroupSelected = bloodGroup !== "" || bloodGroupUnknown;
  const isStep2Valid = bloodGroupSelected && donatedBefore !== null && hasHealthIssues !== null;

  // Compute last donation date string (YYYY-MM-DD approx)
  const getLastDonationDate = (): string | undefined => {
    if (!donatedBefore || !lastDonationYear) return undefined;
    const month = lastDonationMonth ? String(MONTHS.indexOf(lastDonationMonth) + 1).padStart(2, "0") : "06";
    return `${lastDonationYear}-${month}-15`;
  };

  const buildProfile = (skipBlood?: boolean): Parameters<typeof setProfile>[0] => ({
    name: name.trim(),
    gender,
    age: Number(age),
    city: city.trim(),
    workLocation: workLocation.trim(),
    bloodGroup: skipBlood ? "" : (bloodGroup as BloodGroup | ""),
    donatedBefore: skipBlood ? null : donatedBefore,
    hasHealthIssues: skipBlood ? null : hasHealthIssues,
    phone: "",
    // LifeLine donations always start at 0
    donationCount: 0,
    streakMonths: 0,
    // Pre-LifeLine: declared at signup, kept separate
    preLifelineDonations: (!skipBlood && donatedBefore) ? 1 : 0,
    // Last donation date used for eligibility countdown only
    lastDonationDate: skipBlood ? undefined : getLastDonationDate(),
  });

  const handleComplete = async () => {
    setRegistering(true);
    setProfile(buildProfile());
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await fetch("/api/app/users/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Supabase-Auth": session.access_token,
          },
          body: JSON.stringify({
            name: name.trim(),
            phone: session.user?.phone || "",
            email: session.user?.email || "",
            blood_group: bloodGroup || "",
            city: city.trim(),
          }),
        });
      }
    } catch { /* registration is best-effort — profile is saved locally */ }
    setRegistering(false);
    setLocation("/home");
  };

  const handleSkip = () => {
    setProfile(buildProfile(true));
    setLocation("/home");
  };

  const selectBloodGroup = (bg: BloodGroup) => { setBloodGroup(bg); setBloodGroupUnknown(false); };
  const selectUnknown = () => { setBloodGroup(""); setBloodGroupUnknown(true); };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background relative overflow-hidden">
      <div className="h-1 bg-muted">
        <motion.div className="h-full bg-primary" animate={{ width: `${(step / 2) * 100}%` }} transition={{ duration: 0.4, ease: "easeInOut" }} />
      </div>

      <div className="flex items-center justify-between px-4 py-3">
        {step > 1 ? (
          <button onClick={() => setStep(1)} className="w-10 h-10 rounded-full flex items-center justify-center text-foreground hover:bg-muted transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
        ) : <div className="w-10" />}
        <span className="text-sm font-medium text-muted-foreground">Step {step} of 2</span>
        <div className="w-10" />
      </div>

      <div className="flex-1 flex flex-col px-6 pb-8 overflow-y-auto">
        <AnimatePresence mode="wait">

          {/* SCREEN 1 — Personal Details */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }} className="flex flex-col flex-1">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-foreground">About You</h1>
                <p className="text-muted-foreground mt-1">Tell us a bit about yourself</p>
              </div>
              <div className="space-y-5 flex-1">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-sm font-semibold">Full Name</Label>
                  <Input id="name" placeholder="e.g. Priya Sharma" className="h-12 rounded-xl" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Gender</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["male", "female", "other"] as const).map((g) => (
                      <button key={g} onClick={() => setGender(g)}
                        className={`h-11 rounded-xl text-sm font-medium capitalize border-2 transition-all ${gender === g ? "border-primary bg-primary/8 text-primary" : "border-border bg-card text-foreground hover:border-primary/40"}`}>
                        {g === "male" ? "♂ Male" : g === "female" ? "♀ Female" : "⚧ Other"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="age" className="text-sm font-semibold">Age</Label>
                  <Input id="age" type="number" placeholder="e.g. 25" className="h-12 rounded-xl" value={age} onChange={(e) => setAge(e.target.value)} min={1} max={120} />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="city" className="text-sm font-semibold">City you live in</Label>
                    <div className="relative">
                      <button onClick={() => setShowTooltip(!showTooltip)} className="text-muted-foreground hover:text-foreground transition-colors">
                        <Info className="w-4 h-4" />
                      </button>
                      {showTooltip && (
                        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-foreground text-background text-xs rounded-xl p-3 shadow-lg z-10">
                          We use your city to notify you of nearby blood requests. Your work location helps us reach you wherever you are.
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
                        </motion.div>
                      )}
                    </div>
                  </div>
                  <Input id="city" placeholder="e.g. Mumbai, Pune, Delhi, Bengaluru" className="h-12 rounded-xl" value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="work" className="text-sm font-semibold">Where you work <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input id="work" placeholder="e.g. Andheri, Bandra, Connaught Place" className="h-12 rounded-xl" value={workLocation} onChange={(e) => setWorkLocation(e.target.value)} />
                </div>
              </div>
              <div className="pt-6">
                <Button onClick={() => setStep(2)} disabled={!isStep1Valid} className="w-full h-13 text-base font-semibold rounded-xl group">
                  Continue <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* SCREEN 2 — Blood Details */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }} className="flex flex-col flex-1">
              <div className="mb-5">
                <div className="w-11 h-11 bg-primary/10 rounded-2xl flex items-center justify-center mb-3">
                  <Droplet className="w-5 h-5 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">Blood Details</h1>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                  This helps us match you to blood requests.{" "}
                  <span className="text-muted-foreground/70">Only needed for donation features.</span>
                </p>
              </div>

              <div className="space-y-5 flex-1">
                {/* Blood Group */}
                <div className="space-y-2.5">
                  <Label className="text-sm font-semibold">Blood Group</Label>
                  <div className="grid grid-cols-4 gap-2.5">
                    {BLOOD_GROUPS.map((bg) => (
                      <button key={bg} onClick={() => selectBloodGroup(bg)}
                        className={`h-[60px] rounded-2xl text-base font-bold transition-all border-2 ${bloodGroup === bg ? "bg-primary text-primary-foreground border-primary shadow-md scale-[1.04]" : "bg-card border-border text-foreground hover:border-primary/50"}`}>
                        {bg}
                      </button>
                    ))}
                  </div>
                  <button onClick={selectUnknown}
                    className={`w-full flex items-center justify-center gap-2.5 h-12 rounded-xl border-2 text-sm font-semibold transition-all ${bloodGroupUnknown ? "border-primary bg-primary/8 text-primary" : "border-dashed border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}>
                    {bloodGroupUnknown ? <><CheckCircle2 className="w-4 h-4" /> I Don't Know My Blood Group</> : <><HelpCircle className="w-4 h-4" /> I Don't Know My Blood Group</>}
                  </button>
                  <AnimatePresence>
                    {bloodGroupUnknown && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm">
                          <p className="font-semibold text-blue-800 dark:text-blue-300 mb-1">That's completely fine! 👍</p>
                          <p className="text-blue-700 dark:text-blue-400 text-xs leading-relaxed">You can still use all LifeLine features. Your blood group can be added anytime from your Profile once you find out.</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Donated Before */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Have you donated blood before?</Label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {([true, false] as const).map((val) => (
                      <button key={String(val)} onClick={() => setDonatedBefore(val)}
                        className={`h-12 rounded-xl text-sm font-semibold border-2 transition-all ${donatedBefore === val ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground hover:border-primary/50"}`}>
                        {val ? "✓ Yes" : "✗ No"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Last donation date — only shown when donatedBefore = true */}
                <AnimatePresence>
                  {donatedBefore === true && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">
                          When did you last donate? <span className="text-muted-foreground font-normal">(approx.)</span>
                        </Label>
                        <div className="grid grid-cols-2 gap-2">
                          <select value={lastDonationMonth} onChange={(e) => setLastDonationMonth(e.target.value)}
                            className="h-11 rounded-xl border-2 border-border bg-card text-foreground text-sm font-medium px-3 focus:border-primary outline-none">
                            <option value="">Month</option>
                            {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                          </select>
                          <select value={lastDonationYear} onChange={(e) => setLastDonationYear(e.target.value)}
                            className="h-11 rounded-xl border-2 border-border bg-card text-foreground text-sm font-medium px-3 focus:border-primary outline-none">
                            <option value="">Year</option>
                            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                          </select>
                        </div>
                        <p className="text-xs text-muted-foreground">Used only to calculate your donation eligibility (90-day gap rule)</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Health Issues */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Do you have any health issues?</Label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {([true, false] as const).map((val) => (
                      <button key={String(val)} onClick={() => setHasHealthIssues(val)}
                        className={`h-12 rounded-xl text-sm font-semibold border-2 transition-all ${hasHealthIssues === val ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground hover:border-primary/50"}`}>
                        {val ? "Yes" : "No"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-6 space-y-3">
                <Button onClick={handleComplete} disabled={!isStep2Valid || registering} className="w-full h-13 text-base font-semibold rounded-xl">
                  {registering ? "Setting up…" : "All Done — Go to Home"}
                </Button>
                <button onClick={handleSkip} className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors text-center">
                  Skip for now — I'm only here for doctor appointments
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
