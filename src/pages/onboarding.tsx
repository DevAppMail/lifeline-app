import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ChevronLeft, Droplet, Info, HelpCircle, CheckCircle2, Camera, ImagePlus, Loader2, X, User, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile, BloodGroup } from "@/context/profile-context";
import { supabase } from "@/lib/supabase";
import { getOAuthProfile, clearOAuthProfile } from "@/lib/oauth-profile";
import { usePhotoUpload } from "@/hooks/usePhotoUpload";

const BLOOD_GROUPS: BloodGroup[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const YEARS = Array.from({ length: 10 }, (_, i) => String(new Date().getFullYear() - i));
const TOTAL_STEPS = 3;

type PhotoMode = "choice" | "cam-active" | "cam-loading" | "cam-denied" | "gallery-preview" | "cam-preview";

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { setProfile } = useProfile();
  const { uploadPhoto, migrateDataUrl } = usePhotoUpload();
  const [registering, setRegistering] = useState(false);

  const [step, setStep] = useState(1);

  // Screen 1
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other" | "">("");
  const [age, setAge] = useState<string>("");
  const [city, setCity] = useState("");
  const [workLocation, setWorkLocation] = useState("");
  const [showTooltip, setShowTooltip] = useState(false);

  // OAuth profile data (Google avatar for step 3)
  const [oauthName, setOauthName] = useState("");
  const [oauthAvatar, setOauthAvatar] = useState("");

  useEffect(() => {
    const oauth = getOAuthProfile();
    if (oauth) {
      if (oauth.name) {
        setName(oauth.name);
        setOauthName(oauth.name);
      }
      if (oauth.avatar_url) setOauthAvatar(oauth.avatar_url);
      clearOAuthProfile();
    }
  }, []);

  // Screen 2
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | "">("");
  const [bloodGroupUnknown, setBloodGroupUnknown] = useState(false);
  const [donatedBefore, setDonatedBefore] = useState<boolean | null>(null);
  const [hasHealthIssues, setHasHealthIssues] = useState<boolean | null>(null);
  const [lastDonationMonth, setLastDonationMonth] = useState("");
  const [lastDonationYear, setLastDonationYear] = useState("");

  // Screen 3 — Profile Photo
  const [photoMode, setPhotoMode] = useState<PhotoMode>("choice");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const [usingGooglePhoto, setUsingGooglePhoto] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const isStep1Valid =
    name.trim().length >= 2 &&
    gender !== "" &&
    age !== "" &&
    Number(age) >= 1 &&
    Number(age) <= 120 &&
    city.trim().length >= 2;

  const bloodGroupSelected = bloodGroup !== "" || bloodGroupUnknown;
  const isStep2Valid = bloodGroupSelected && donatedBefore !== null && hasHealthIssues !== null;

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
    donationCount: 0,
    streakMonths: 0,
    preLifelineDonations: (!skipBlood && donatedBefore) ? 1 : 0,
    lastDonationDate: skipBlood ? undefined : getLastDonationDate(),
  });

  const doUploadPhoto = async (): Promise<string | null> => {
    if (!photoDataUrl) return null;
    setPhotoUploading(true);
    try {
      const timestamp = Date.now();
      const fileName = `profile_${timestamp}.webp`;
      const { publicUrl } = await migrateDataUrl(photoDataUrl, "avatars", fileName, {
        maxWidth: 400,
        quality: 0.8,
        format: "image/webp",
      });
      if (publicUrl) return publicUrl;
    } catch { /* fall through to skip */ }
    setPhotoUploading(false);
    return null;
  };

  const handleComplete = async () => {
    setRegistering(true);

    const publicUrl = photoDataUrl && !photoUploaded ? await doUploadPhoto() : null;
    const now = new Date().toISOString();

    const photoField: Record<string, unknown> = {};
    if (publicUrl || usingGooglePhoto) {
      photoField.profile_photo_url = publicUrl || oauthAvatar;
      photoField.profile_photo_source = usingGooglePhoto ? "google_profile"
        : photoDataUrl ? (photoMode === "cam-preview" ? "camera" : "gallery") : undefined;
      photoField.profile_photo_uploaded_at = now;
      photoField.profile_photo_updated_at = now;
    }

    setProfile({ ...buildProfile(), ...photoField } as Parameters<typeof setProfile>[0]);

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
    } catch { /* best-effort */ }

    setRegistering(false);
    setLocation("/home");
  };

  const handleSkip = () => {
    setProfile(buildProfile(true));
    setLocation("/home");
  };

  const selectBloodGroup = (bg: BloodGroup) => { setBloodGroup(bg); setBloodGroupUnknown(false); };
  const selectUnknown = () => { setBloodGroup(""); setBloodGroupUnknown(true); };

  // ── Photo helpers ──────────────────────────────────────────────────

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const size = Math.min(video.videoWidth, video.videoHeight, 480);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    // Mirror for selfie
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, (video.videoWidth - size) / 2, (video.videoHeight - size) / 2, size, size, -size, 0, size, size);
    ctx.restore();
    const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
    setPhotoDataUrl(dataUrl);
    setPhotoPreview(dataUrl);
    setUsingGooglePhoto(false);
    setPhotoMode("cam-preview");
    stopStream();
  };

  const startCamera = async () => {
    setPhotoMode("cam-loading");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera not available");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "user" }, width: { ideal: 480 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      setPhotoMode("cam-active");
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch {
      setPhotoMode("cam-denied");
    }
  };

  const handleGalleryFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current!;
        const size = Math.min(img.naturalWidth, img.naturalHeight, 480);
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, (img.naturalWidth - size) / 2, (img.naturalHeight - size) / 2, size, size, 0, 0, size, size);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
        setPhotoDataUrl(dataUrl);
        setPhotoPreview(dataUrl);
        setUsingGooglePhoto(false);
        setPhotoMode("gallery-preview");
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const resetPhoto = () => {
    setPhotoMode("choice");
    setPhotoPreview(null);
    setPhotoDataUrl(null);
    setPhotoUploaded(false);
    setUsingGooglePhoto(false);
  };

  const acceptGooglePhoto = () => {
    setUsingGooglePhoto(true);
    setPhotoDataUrl(null);
    setPhotoPreview(oauthAvatar);
    setPhotoMode("gallery-preview");
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background relative overflow-hidden">
      <div className="h-1 bg-muted">
        <motion.div className="h-full bg-primary" animate={{ width: `${(step / TOTAL_STEPS) * 100}%` }} transition={{ duration: 0.4, ease: "easeInOut" }} />
      </div>

      <div className="flex items-center justify-between px-4 py-3">
        {step > 1 ? (
          <button onClick={() => setStep(step - 1)} className="w-10 h-10 rounded-full flex items-center justify-center text-foreground hover:bg-muted transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
        ) : <div className="w-10" />}
        <span className="text-sm font-medium text-muted-foreground">Step {step} of {TOTAL_STEPS}</span>
        <div className="w-10" />
      </div>

      <div className="flex-1 flex flex-col px-6 pb-8 overflow-y-auto">
        <AnimatePresence mode="wait">

          {/* ══════════ STEP 1 — Personal Details ══════════ */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }} className="flex flex-col flex-1">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-foreground">About You</h1>
                <p className="text-muted-foreground mt-1">Tell us a bit about yourself</p>
              </div>
              <div className="space-y-5 flex-1">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-sm font-semibold">Full Name</Label>
                  <Input id="name" placeholder={oauthName ? oauthName : "e.g. Rohit Naik"} className="h-12 rounded-xl" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
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
                  <Input id="city" placeholder="e.g. Ponda, Margao, Panjim, Mapusa" className="h-12 rounded-xl" value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="work" className="text-sm font-semibold">Where you work <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input id="work" placeholder="e.g. Panjim, Margao, Vasco" className="h-12 rounded-xl" value={workLocation} onChange={(e) => setWorkLocation(e.target.value)} />
                </div>
              </div>
              <div className="pt-6">
                <Button onClick={() => setStep(2)} disabled={!isStep1Valid} className="w-full h-13 text-base font-semibold rounded-xl group">
                  Continue <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ══════════ STEP 2 — Blood Details ══════════ */}
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
                          <p className="font-semibold text-blue-800 dark:text-blue-300 mb-1">That's completely fine!</p>
                          <p className="text-blue-700 dark:text-blue-400 text-xs leading-relaxed">You can still use all LifeLine features. Your blood group can be added anytime from your Profile once you find out.</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

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
                <Button onClick={() => setStep(3)} disabled={!isStep2Valid} className="w-full h-13 text-base font-semibold rounded-xl group">
                  Continue <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
                <button onClick={handleSkip} className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors text-center">
                  Skip for now — I'm only here for doctor appointments
                </button>
              </div>
            </motion.div>
          )}

          {/* ══════════ STEP 3 — Profile Photo ══════════ */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }} className="flex flex-col flex-1">
              <div className="mb-5">
                <div className="w-11 h-11 bg-primary/10 rounded-2xl flex items-center justify-center mb-3">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">Add Your Profile Photo</h1>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                  A profile photo helps build trust across the LifeLine community.
                </p>
              </div>

              <div className="flex-1 space-y-4">

                {/* ── Google photo pre-fill ── */}
                {oauthAvatar && !photoDataUrl && !usingGooglePhoto && (
                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 space-y-3">
                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Google profile photo found</p>
                    <div className="flex items-center gap-4">
                      <img src={oauthAvatar} alt="Google avatar" className="w-16 h-16 rounded-2xl object-cover border-2 border-blue-200" />
                      <div className="space-y-2 flex-1">
                        <button onClick={acceptGooglePhoto} className="w-full h-10 rounded-xl bg-blue-600 text-white text-sm font-semibold">
                          Use Google Profile Photo
                        </button>
                        <button onClick={() => setOauthAvatar("")} className="w-full h-10 rounded-xl text-sm font-medium text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-700">
                          Change Photo
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Choice ── */}
                {photoMode === "choice" && !oauthAvatar && (
                  <>
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 rounded-2xl p-4">
                      <div className="flex items-start gap-3">
                        <Shield className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">A real photo helps everyone</p>
                          <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1 leading-relaxed">
                            For healthcare interactions, we recommend using a recent photo of yourself. This helps donors, patients, doctors, and hospitals identify you accurately. Your photo is only visible to people you interact with on LifeLine.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={startCamera}
                        className="flex flex-col items-center gap-3 p-5 border-2 border-border rounded-2xl hover:border-primary/50 hover:bg-primary/5 transition-all">
                        <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
                          <Camera className="w-7 h-7 text-primary" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-semibold text-foreground">Take Photo</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">Use your camera</p>
                        </div>
                      </button>
                      <button onClick={() => galleryRef.current?.click()}
                        className="flex flex-col items-center gap-3 p-5 border-2 border-border rounded-2xl hover:border-primary/50 hover:bg-primary/5 transition-all">
                        <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
                          <ImagePlus className="w-7 h-7 text-primary" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-semibold text-foreground">Upload Photo</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">From your gallery</p>
                        </div>
                      </button>
                    </div>
                    <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleGalleryFile} />
                  </>
                )}

                {/* ── CAM LOADING ── */}
                {photoMode === "cam-loading" && (
                  <div className="flex flex-col items-center gap-3 py-12">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <p className="text-sm text-muted-foreground">Opening camera...</p>
                  </div>
                )}

                {/* ── CAM ACTIVE ── */}
                {photoMode === "cam-active" && (
                  <div className="space-y-3">
                    <div className="relative rounded-2xl overflow-hidden bg-black aspect-square">
                      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => { stopStream(); setPhotoMode("choice"); }}
                        className="h-11 rounded-xl text-sm font-medium border-2 border-border text-foreground">Cancel</button>
                      <button onClick={capturePhoto}
                        className="h-11 rounded-xl text-sm font-bold bg-primary text-white flex items-center justify-center gap-2">
                        <Camera className="w-4 h-4" /> Capture
                      </button>
                    </div>
                  </div>
                )}

                {/* ── CAM DENIED ── */}
                {photoMode === "cam-denied" && (
                  <div className="space-y-3">
                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
                      <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Camera access unavailable</p>
                      <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">You can upload a photo from your gallery instead.</p>
                    </div>
                    <button onClick={() => galleryRef.current?.click()}
                      className="w-full h-12 rounded-xl text-sm font-bold bg-primary text-white flex items-center justify-center gap-2">
                      <ImagePlus className="w-4 h-4" /> Upload From Gallery
                    </button>
                    <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleGalleryFile} />
                  </div>
                )}

                {/* ── PREVIEW (camera or gallery) ── */}
                {(photoMode === "cam-preview" || photoMode === "gallery-preview") && photoPreview && (
                  <div className="space-y-3">
                    <div className="rounded-2xl overflow-hidden aspect-square bg-muted">
                      <img src={photoPreview} alt="Profile preview" className="w-full h-full object-cover" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={resetPhoto} className="h-11 rounded-xl font-semibold text-sm border-2 border-border text-foreground">Retake</button>
                      <button onClick={() => setPhotoUploaded(true)}
                        className="h-11 rounded-xl font-bold text-sm bg-primary text-white flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" /> Use This Photo
                      </button>
                    </div>
                    {usingGooglePhoto && (
                      <p className="text-xs text-center text-muted-foreground">Using your Google profile photo</p>
                    )}
                  </div>
                )}

              </div>

              {/* CTA */}
              <div className="pt-6 space-y-3">
                <Button onClick={handleComplete} disabled={registering || photoUploading} className="w-full h-13 text-base font-semibold rounded-xl">
                  {registering || photoUploading ? "Setting up…" : `Complete Setup — Go to Home`}
                </Button>
                <button onClick={handleComplete} className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors text-center">
                  Skip for now — I'll add a photo later
                </button>
              </div>

              <canvas ref={canvasRef} className="hidden" />
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
