import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, ArrowRight, Droplet, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/context/profile-context";
import { supabase } from "@/lib/supabase";

type Step = "phone" | "otp";

// Converts Indian mobile numbers to E.164 format for Supabase
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

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [otpError, setOtpError] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const handleSendOtp = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setPhoneError("Enter a valid 10-digit mobile number");
      return;
    }
    setSending(true);
    setPhoneError("");
    const { error } = await supabase.auth.signInWithOtp({ phone: toE164(phone) });
    setSending(false);
    if (error) {
      setPhoneError(error.message);
      return;
    }
    setStep("otp");
  };

  const handleVerify = async () => {
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

    // Sync donation stats from DB silently — non-blocking
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
    } catch { /* silent — app works with local profile */ }

    setVerifying(false);
    setLocation(profile?.name ? "/home" : "/onboarding");
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[45%] bg-primary rounded-b-[3rem] -z-0" />

      <div className="relative z-10 flex flex-col flex-1">
        <div className="p-4 pt-12">
          {step === "otp" && (
            <button
              onClick={() => { setStep("phone"); setOtp(""); setOtpError(false); }}
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

            {step === "phone" && (
              <motion.div
                key="phone"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Enter your number</h2>
                  <p className="text-muted-foreground mt-1">We'll send a verification code via SMS</p>
                </div>
                <div className="space-y-2">
                  <div className="relative">
                    <Phone className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground" />
                    <Input
                      type="tel"
                      placeholder="+91 98765 43210"
                      className="pl-12 h-12 text-base rounded-xl"
                      value={phone}
                      onChange={(e) => { setPhone(e.target.value); setPhoneError(""); }}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSendOtp(); }}
                      autoFocus
                    />
                  </div>
                  {phoneError && <p className="text-sm text-destructive font-medium">{phoneError}</p>}
                </div>
                <Button
                  onClick={handleSendOtp}
                  disabled={sending}
                  className="w-full h-12 text-base font-semibold rounded-xl group"
                >
                  {sending ? "Sending…" : (
                    <><span>Send OTP</span><ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" /></>
                  )}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  By continuing, you agree to LifeLine's Terms & Privacy Policy
                </p>
              </motion.div>
            )}

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
                  {/* Hidden input captures keyboard/native input */}
                  <input
                    type="number"
                    className="opacity-0 absolute w-0 h-0"
                    value={otp}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setOtp(val);
                      setOtpError(false);
                      if (val.length === 6) handleVerify();
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

                {/* Custom numpad */}
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
                  onClick={handleVerify}
                  disabled={otp.length < 6 || verifying}
                  className="w-full h-12 text-base font-semibold rounded-xl"
                >
                  {verifying ? "Verifying…" : "Verify & Continue"}
                </Button>
                <button
                  onClick={handleSendOtp}
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
