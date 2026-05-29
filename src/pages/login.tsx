import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, ArrowRight, Droplet, ChevronLeft, Mail, CheckCircle, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/context/profile-context";
import { supabase } from "@/lib/supabase";

const LANDING_URL = "https://lifeline-landing.vercel.app";

type Step = "input" | "email-sent" | "otp";
type AuthMethod = "phone" | "email";
type OtpChannel = "whatsapp" | "sms";

function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `+91${digits.slice(1)}`;
  return digits.startsWith("+") ? raw.trim() : `+${digits}`;
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
    </svg>
  );
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { profile, updateProfile, isAuthenticated, isLoading } = useProfile();

  const [method, setMethod] = useState<AuthMethod>("phone");
  const [step, setStep] = useState<Step>("input");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpChannel, setOtpChannel] = useState<OtpChannel | null>(null);
  const [inputError, setInputError] = useState("");
  const [otpError, setOtpError] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.email) { setLocation("/home"); return; }
        const res = await fetch(`/api/users/lookup?email=${encodeURIComponent(session.user.email)}`);
        if (res.ok) {
          const data = await res.json() as {
            user: { name?: string; blood_group?: string; location?: string };
            donor: { lifeline_donations: number; pre_lifeline_donations: number; last_donation_date: string | null } | null;
          };
          updateProfile({
            ...(data.user?.blood_group ? { bloodGroup: data.user.blood_group as any } : {}),
            ...(data.user?.location ? { city: data.user.location } : {}),
            ...(data.donor ? {
              donationCount: data.donor.lifeline_donations,
              preLifelineDonations: data.donor.pre_lifeline_donations,
              lastDonationDate: data.donor.last_donation_date ?? undefined,
            } : {}),
          });
          setLocation(profile?.name || data.user?.name ? "/home" : "/onboarding");
        } else {
          setLocation("/onboarding");
        }
      } catch {
        setLocation(profile?.name ? "/home" : "/onboarding");
      }
    })();
  }, [isAuthenticated, isLoading]);

  const handleTabSwitch = (m: AuthMethod) => {
    setMethod(m);
    setInputError("");
  };

  const sendPhoneOtp = async (channel: OtpChannel) => {
    setInputError("");
    setOtpChannel(channel);
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setInputError("Enter a valid 10-digit mobile number");
      return;
    }
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: toE164(phone) });
    setSending(false);
    if (error) {
      setInputError(error.message);
      return;
    }
    setStep("otp");
  };

  const handleSendEmail = async () => {
    setInputError("");
    if (!email.includes("@") || !email.includes(".")) {
      setInputError("Enter a valid email address");
      return;
    }
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setSending(false);
    if (error) { setInputError(error.message); return; }
    setStep("email-sent");
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 6 || verifying) return;
    setVerifying(true);
    setOtpError(false);

    const { error } = await supabase.auth.verifyOtp({
      phone: toE164(phone),
      token: otp,
      type: "sms",
    });

    if (error) {
      setVerifying(false);
      setOtpError(true);
      setOtp("");
      return;
    }

    try {
      const res = await fetch(`/api/users/lookup?phone=${encodeURIComponent(toE164(phone))}`);
      if (res.ok) {
        const data = await res.json() as {
          user: { id: number; blood_group: string; location: string };
          donor: { lifeline_donations: number; pre_lifeline_donations: number; last_donation_date: string | null } | null;
        };
        updateProfile({
          phone: toE164(phone),
          ...(data.user.blood_group ? { bloodGroup: data.user.blood_group as any } : {}),
          ...(data.user.location ? { city: data.user.location } : {}),
          ...(data.donor ? {
            donationCount: data.donor.lifeline_donations,
            preLifelineDonations: data.donor.pre_lifeline_donations,
            lastDonationDate: data.donor.last_donation_date ?? undefined,
          } : {}),
        });
      }
    } catch { /* silent */ }

    setVerifying(false);
    setLocation(profile?.name ? "/home" : "/onboarding");
  };

  const goBack = () => {
    setStep("input");
    setOtp("");
    setOtpError(false);
    setInputError("");
    setOtpChannel(null);
  };

  const handleDevLogin = async () => {
    if (import.meta.env.VITE_APP_MODE === 'production') return;
    localStorage.setItem("lifeline_dev_bypass", "true");
    localStorage.setItem("lifeline_profile", JSON.stringify({
      phone: "919000000000",
      bloodGroup: "B+",
      name: "Rohit Naik",
      city: "Ponda",
      age: 28,
      gender: "male",
      donationCount: 3,
      streakMonths: 2,
      preLifelineDonations: 1,
      donatedBefore: true,
      hasHealthIssues: false,
      lastDonationDate: "2026-02-10T00:00:00.000Z",
    }));
    try {
      const res = await fetch("/api/app/identity/dev-bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Rohit Naik" }),
      });
      if (res.ok) {
        const { token } = await res.json() as { token: string };
        localStorage.setItem("lifeline_federated_token", token);
      }
    } catch { /* dev-bridge unavailable — carry on without federated token */ }
    window.location.href = "/home";
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[45%] bg-primary rounded-b-[3rem] -z-0" />

      <div className="relative z-10 flex flex-col flex-1">
        <div className="p-4 pt-12">
          {(step === "otp" || step === "email-sent") && (
            <button
              onClick={goBack}
              className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="px-6 pb-8 text-center text-white">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/30">
            <Droplet className="w-8 h-8 fill-white text-white" />
          </div>
          <h1 className="text-3xl font-bold">LifeLine</h1>
          <p className="text-white/70 mt-1 text-sm">Saving lives, together</p>
        </div>

        <div className="flex-1 bg-background rounded-t-[2.5rem] px-6 pt-8 pb-10">
          <AnimatePresence mode="wait">

            {/* ── Input step ── */}
            {step === "input" && (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                {/* Tab pills — Phone first */}
                <div className="flex bg-muted rounded-xl p-1 gap-1">
                  {(["phone", "email"] as AuthMethod[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => handleTabSwitch(m)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                        method === m
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {m === "phone" ? <Phone className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                      {m === "phone" ? "Phone" : "Email"}
                    </button>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  {/* ── PHONE FORM ── */}
                  {method === "phone" && (
                    <motion.div
                      key="phone-form"
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 12 }}
                      transition={{ duration: 0.18 }}
                      className="space-y-4"
                    >
                      <div>
                        <h2 className="text-2xl font-bold text-foreground">Enter your phone number</h2>
                        <p className="text-muted-foreground mt-1 text-sm">Sign in or create an account</p>
                      </div>
                      <div className="space-y-2">
                        <div className="relative">
                          <Phone className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground" />
                          <Input
                            type="tel"
                            placeholder="+91 98765 43210"
                            className="pl-12 h-12 text-base rounded-xl"
                            value={phone}
                            onChange={(e) => { setPhone(e.target.value); setInputError(""); }}
                            onKeyDown={(e) => { if (e.key === "Enter") sendPhoneOtp("whatsapp"); }}
                            autoFocus
                          />
                        </div>
                        {inputError && <p className="text-sm text-destructive font-medium">{inputError}</p>}
                      </div>

                      {/* Primary: WhatsApp OTP */}
                      <Button
                        onClick={() => sendPhoneOtp("whatsapp")}
                        disabled={sending}
                        className="w-full h-12 text-base font-semibold rounded-xl group bg-[#25D366] hover:bg-[#22c35e] text-white border-0"
                      >
                        {sending && otpChannel === "whatsapp" ? "Sending…" : (
                          <><WhatsAppIcon className="mr-2 h-5 w-5" /> Send OTP on WhatsApp</>
                        )}
                      </Button>

                      {/* Divider */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs text-muted-foreground font-medium">Not a WhatsApp user?</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>

                      {/* Secondary: SMS OTP */}
                      <Button
                        variant="outline"
                        onClick={() => sendPhoneOtp("sms")}
                        disabled={sending}
                        className="w-full h-12 text-base font-semibold rounded-xl border-2"
                      >
                        {sending && otpChannel === "sms" ? "Sending…" : (
                          <><MessageCircle className="mr-2 h-5 w-5" /> Send OTP via SMS</>
                        )}
                      </Button>
                    </motion.div>
                  )}

                  {/* ── EMAIL FORM ── */}
                  {method === "email" && (
                    <motion.div
                      key="email-form"
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.18 }}
                      className="space-y-4"
                    >
                      <div>
                        <h2 className="text-2xl font-bold text-foreground">Enter your email</h2>
                        <p className="text-muted-foreground mt-1 text-sm">We'll send a secure sign-in link to your inbox</p>
                      </div>
                      <div className="space-y-2">
                        <div className="relative">
                          <Mail className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground" />
                          <Input
                            type="email"
                            placeholder="you@example.com"
                            className="pl-12 h-12 text-base rounded-xl"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); setInputError(""); }}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSendEmail(); }}
                            autoFocus
                          />
                        </div>
                        {inputError && <p className="text-sm text-destructive font-medium">{inputError}</p>}
                      </div>
                      <Button
                        onClick={handleSendEmail}
                        disabled={sending}
                        className="w-full h-12 text-base font-semibold rounded-xl group"
                      >
                        {sending ? "Sending…" : (
                          <><span>Send Secure Sign-In Link</span><ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" /></>
                        )}
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <p className="text-xs text-center text-muted-foreground">
                  By continuing, you agree to LifeLine's{" "}
                  <a
                    href={LANDING_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary font-medium underline underline-offset-2 hover:text-primary/80 transition-colors"
                  >
                    Terms &amp; Conditions
                  </a>
                </p>

                {import.meta.env.VITE_APP_MODE !== 'production' && (
                <div className="flex justify-center pt-1">
                  <button
                    onClick={handleDevLogin}
                    className="text-xs text-muted-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors"
                  >
                    Dev Login (Test Mode)
                  </button>
                </div>
                )}
              </motion.div>
            )}

            {/* ── Email sent confirmation ── */}
            {step === "email-sent" && (
              <motion.div
                key="email-sent"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.25 }}
                className="space-y-6 text-center"
              >
                <div className="flex flex-col items-center gap-4 pt-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">Check your email</h2>
                    <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                      We sent a secure sign-in link to{" "}
                      <span className="font-semibold text-foreground">{email}</span>.
                      <br />
                      Click the link in the email to sign in.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-muted/40 px-4 py-4 text-left space-y-1">
                  <p className="text-xs text-muted-foreground">Didn't get it? Check your spam folder, or</p>
                  <button
                    onClick={handleSendEmail}
                    disabled={sending}
                    className="text-sm text-primary font-semibold disabled:opacity-50"
                  >
                    {sending ? "Sending…" : "Resend secure sign-in link"}
                  </button>
                </div>

                <button
                  onClick={goBack}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Use a different email
                </button>
              </motion.div>
            )}

            {/* ── Phone OTP entry ── */}
            {step === "otp" && (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Enter OTP</h2>
                  <p className="text-muted-foreground mt-1">
                    Code sent to <span className="font-medium text-foreground">{phone}</span>
                    {otpChannel === "whatsapp" && (
                      <span className="text-[#25D366] font-medium"> via WhatsApp</span>
                    )}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex gap-2 justify-center">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`w-12 h-14 rounded-2xl border-2 flex items-center justify-center text-xl font-bold transition-all ${
                          otp[i]
                            ? otpError
                              ? "border-destructive bg-destructive/5 text-destructive"
                              : "border-primary bg-primary/5 text-primary"
                            : "border-border bg-muted/50"
                        }`}
                      >
                        {otp[i] ?? ""}
                      </div>
                    ))}
                  </div>
                  <input
                    type="number"
                    className="opacity-0 absolute w-0 h-0"
                    value={otp}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setOtp(val);
                      setOtpError(false);
                      if (val.length === 6) handleVerifyOtp();
                    }}
                    autoFocus
                    inputMode="numeric"
                    id="otp-hidden"
                  />
                  <label htmlFor="otp-hidden" className="flex gap-2 justify-center cursor-text -mt-[4.5rem] h-16" />
                  {otpError && (
                    <p className="text-sm text-destructive font-medium text-center">
                      Incorrect code. Please try again.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((key) => (
                    <button
                      key={key}
                      onClick={() => {
                        if (!key) return;
                        if (key === "⌫") { setOtp((p) => p.slice(0, -1)); setOtpError(false); }
                        else if (otp.length < 6) { setOtp((p) => p + key); setOtpError(false); }
                      }}
                      className={`h-14 rounded-2xl text-lg font-semibold transition-all active:scale-95 ${
                        !key ? "invisible" : key === "⌫" ? "bg-muted text-muted-foreground" : "bg-muted/70 text-foreground hover:bg-muted"
                      }`}
                    >
                      {key}
                    </button>
                  ))}
                </div>

                <Button
                  onClick={handleVerifyOtp}
                  disabled={otp.length < 6 || verifying}
                  className="w-full h-12 text-base font-semibold rounded-xl"
                >
                  {verifying ? "Verifying…" : "Verify & Continue"}
                </Button>
                <button
                  onClick={() => sendPhoneOtp(otpChannel ?? "sms")}
                  disabled={sending}
                  className="w-full text-sm text-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  Didn't receive code?{" "}
                  <span className="text-primary font-medium">{sending ? "Sending…" : "Resend"}</span>
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
