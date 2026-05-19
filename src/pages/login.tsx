import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, ArrowRight, Droplet, ChevronLeft, Mail, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/context/profile-context";
import { supabase } from "@/lib/supabase";

type Step = "input" | "email-sent" | "otp";
type AuthMethod = "email" | "phone";

function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `+91${digits.slice(1)}`;
  return digits.startsWith("+") ? raw.trim() : `+${digits}`;
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { profile, updateProfile } = useProfile();

  const [method, setMethod] = useState<AuthMethod>("email");
  const [step, setStep] = useState<Step>("input");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [inputError, setInputError] = useState("");
  const [otpError, setOtpError] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const handleTabSwitch = (m: AuthMethod) => {
    setMethod(m);
    setInputError("");
  };

  const handleSend = async () => {
    setInputError("");

    if (method === "email") {
      if (!email.includes("@") || !email.includes(".")) {
        setInputError("Enter a valid email address");
        return;
      }
      setSending(true);
      const { error } = await supabase.auth.signInWithOtp({ email });
      setSending(false);
      if (error) { setInputError(error.message); return; }
      setStep("email-sent");
    } else {
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 10) {
        setInputError("Enter a valid 10-digit mobile number");
        return;
      }
      setSending(true);
      const { error } = await supabase.auth.signInWithOtp({ phone: toE164(phone) });
      setSending(false);
      if (error) { setInputError(error.message); return; }
      setStep("otp");
    }
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
                {/* Tab pills */}
                <div className="flex bg-muted rounded-xl p-1 gap-1">
                  {(["email", "phone"] as AuthMethod[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => handleTabSwitch(m)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                        method === m
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {m === "email" ? <Mail className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                      {m === "email" ? "Email" : "Phone"}
                    </button>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  {method === "email" ? (
                    <motion.div
                      key="email-form"
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 12 }}
                      transition={{ duration: 0.18 }}
                      className="space-y-4"
                    >
                      <div>
                        <h2 className="text-2xl font-bold text-foreground">Enter your email</h2>
                        <p className="text-muted-foreground mt-1 text-sm">We'll send a magic link to sign you in</p>
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
                            onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
                            autoFocus
                          />
                        </div>
                        {inputError && <p className="text-sm text-destructive font-medium">{inputError}</p>}
                      </div>
                      <Button
                        onClick={handleSend}
                        disabled={sending}
                        className="w-full h-12 text-base font-semibold rounded-xl group"
                      >
                        {sending ? "Sending…" : (
                          <><span>Send Magic Link</span><ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" /></>
                        )}
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="phone-form"
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.18 }}
                      className="space-y-4"
                    >
                      <div>
                        <h2 className="text-2xl font-bold text-foreground">Enter your number</h2>
                        <p className="text-muted-foreground mt-1 text-sm">New or returning? Enter your number to continue</p>
                      </div>
                      <div className="rounded-xl border border-border bg-muted/40 px-4 py-5 text-center space-y-1">
                        <p className="text-sm font-semibold text-foreground">Phone login coming soon</p>
                        <p className="text-xs text-muted-foreground">SMS verification is not yet available. Please use Email to sign in.</p>
                      </div>
                      <div className="relative opacity-50 pointer-events-none">
                        <Phone className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground" />
                        <Input
                          type="tel"
                          placeholder="+91 98765 43210"
                          className="pl-12 h-12 text-base rounded-xl"
                          value={phone}
                          disabled
                        />
                      </div>
                      <Button disabled className="w-full h-12 text-base font-semibold rounded-xl opacity-50">
                        Send OTP
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <p className="text-xs text-center text-muted-foreground">
                  By continuing, you agree to LifeLine's Terms &amp; Privacy Policy
                </p>
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
                      We sent a magic link to{" "}
                      <span className="font-semibold text-foreground">{email}</span>.
                      <br />
                      Click the link in the email to sign in.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-muted/40 px-4 py-4 text-left space-y-1">
                  <p className="text-xs text-muted-foreground">Didn't get it? Check your spam folder, or</p>
                  <button
                    onClick={handleSend}
                    disabled={sending}
                    className="text-sm text-primary font-semibold disabled:opacity-50"
                  >
                    {sending ? "Sending…" : "Resend magic link"}
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
                  onClick={handleSend}
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
