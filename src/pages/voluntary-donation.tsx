import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { usePhotoUpload } from "@/hooks/usePhotoUpload";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Heart, Droplet, Calendar, MapPin,
  Upload, Camera, CheckCircle2, Loader2,
} from "lucide-react";
import { useProfile } from "@/context/profile-context";
import { addContribution } from "@/lib/contribution-store";
import { toast } from "sonner";
import { AppreciationCard, AppreciationCardActions, useAppreciationCard } from "@/components/appreciation-card";
import type { AppreciationCardData, ContributionType } from "@/types/contribution";

type FlowStep = "form" | "success";

export default function VoluntaryDonation() {
  const [, setLocation] = useLocation();
  const { profile } = useProfile();
  const { saveCard, shareCard, whatsAppShare } = useAppreciationCard();

  const [step, setStep] = useState<FlowStep>("form");
  const [submitting, setSubmitting] = useState(false);

  const [donationDate, setDonationDate] = useState(new Date().toISOString().split("T")[0]);
  const [location, setLocationState] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [donationCardFile, setDonationCardFile] = useState<File | null>(null);
  const [donationPhotoFile, setDonationPhotoFile] = useState<File | null>(null);
  const [cardPreview, setCardPreview] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoStorageUrl, setPhotoStorageUrl] = useState<string | null>(null);

  const { uploadPhoto } = usePhotoUpload();

  const [appreciationCardId, setAppreciationCardId] = useState<string | null>(null);

  const cardInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handleCardUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDonationCardFile(file);
    const reader = new FileReader();
    reader.onload = () => setCardPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDonationPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
    const { publicUrl } = await uploadPhoto(file, 'donation-photos',
      `donation_${Date.now()}.webp`,
      { maxWidth: 800, quality: 0.7, format: 'image/webp' }
    );
    if (publicUrl) setPhotoStorageUrl(publicUrl);
  };

  const handleSubmit = async () => {
    if (!profile?.lifeline_id || !profile?.name) return;
    setSubmitting(true);

    const cardId = `appreciation-${Date.now().toString(36)}`;

    try {
      const isCamp = organizer.length > 0 || location.length > 0;
      const type: ContributionType = isCamp ? "camp_donation" : "independent_donation";

      addContribution({
        type,
        lifelineId: profile.lifeline_id,
        donorName: profile.name,
        donationDate,
        location: location || undefined,
        organizer: organizer || undefined,
        donationCardUrl: cardPreview ?? undefined,
        donationPhotoUrl: photoStorageUrl ?? photoPreview ?? undefined,
      });

      setAppreciationCardId(cardId);
      setSubmitting(false);
      setStep("success");
    } catch (err) {
      setSubmitting(false);
      toast.error("Failed to save donation. Please try again.");
    }
  };

  const appreciationCardData: AppreciationCardData | null = appreciationCardId
    ? {
        donorName: profile?.name ?? "Donor",
        donationDate,
        type: "independent",
        cardId: appreciationCardId,
        generatedAt: new Date().toISOString(),
      }
    : null;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-4 border-b border-border">
        <button onClick={() => setLocation("/home")} className="w-10 h-10 rounded-full flex items-center justify-center bg-muted hover:bg-muted/80">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">I Donated Blood</h1>
          <p className="text-sm text-muted-foreground">Record your voluntary donation</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-8">
        <AnimatePresence mode="wait">
          {step === "form" && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-5"
            >
              {/* Hero */}
              <div className="bg-gradient-to-br from-primary/5 to-card border border-primary/20 rounded-3xl p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Droplet className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-lg font-bold text-foreground">Record Your Donation</h2>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto leading-relaxed">
                  Whether at a camp, hospital, or blood bank — we want to remember your contribution.
                </p>
              </div>

              {/* Form */}
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                {/* Date */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 block">
                    Donation Date
                  </label>
                  <div className="flex items-center gap-3 bg-muted rounded-xl px-4 py-3">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <input
                      type="date"
                      value={donationDate}
                      onChange={(e) => setDonationDate(e.target.value)}
                      max={new Date().toISOString().split("T")[0]}
                      className="flex-1 bg-transparent text-foreground text-sm outline-none"
                    />
                  </div>
                </div>

                {/* Location */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 block">
                    Location / Camp
                  </label>
                  <div className="flex items-center gap-3 bg-muted rounded-xl px-4 py-3">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocationState(e.target.value)}
                      placeholder="e.g., Red Cross Camp, Mumbai"
                      className="flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-muted-foreground/50"
                    />
                  </div>
                </div>

                {/* Organizer */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 block">
                    Organizer (optional)
                  </label>
                  <div className="flex items-center gap-3 bg-muted rounded-xl px-4 py-3">
                    <Heart className="w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={organizer}
                      onChange={(e) => setOrganizer(e.target.value)}
                      placeholder="e.g., Indian Red Cross Society"
                      className="flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-muted-foreground/50"
                    />
                  </div>
                </div>

                {/* Donation Card Upload */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 block">
                    Donation Card / Slip (optional)
                  </label>
                  <input
                    ref={cardInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCardUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => cardInputRef.current?.click()}
                    className="w-full flex items-center gap-3 bg-muted rounded-xl px-4 py-3 text-left hover:bg-muted/80 transition-colors"
                  >
                    <Upload className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {donationCardFile ? donationCardFile.name : "Upload donation card"}
                    </span>
                  </button>
                  {cardPreview && (
                    <div className="mt-2 relative">
                      <img src={cardPreview} alt="Donation card" className="w-full h-32 object-cover rounded-xl" />
                      <button
                        onClick={() => { setDonationCardFile(null); setCardPreview(null); }}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                {/* Photo Upload */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 block">
                    Donation Photo (optional)
                  </label>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => photoInputRef.current?.click()}
                    className="w-full flex items-center gap-3 bg-muted rounded-xl px-4 py-3 text-left hover:bg-muted/80 transition-colors"
                  >
                    <Camera className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {donationPhotoFile ? donationPhotoFile.name : "Upload donation photo"}
                    </span>
                  </button>
                  {photoPreview && (
                    <div className="mt-2 relative">
                      <img src={photoPreview} alt="Donation photo" className="w-full h-32 object-cover rounded-xl" />
                      <button
                        onClick={() => { setDonationPhotoFile(null); setPhotoPreview(null); }}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={submitting || !donationDate}
                className="w-full h-12 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Heart className="w-4 h-4" />
                )}
                Record Donation
              </button>
            </motion.div>
          )}

          {step === "success" && appreciationCardData && (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              {/* Success header */}
              <div className="text-center pt-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto mb-3"
                >
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </motion.div>
                <h2 className="text-lg font-bold text-foreground">Thank You</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Your donation has been recorded.
                </p>
              </div>

              {/* Appreciation Card */}
              <AppreciationCard data={appreciationCardData} />
              <AppreciationCardActions
                cardId={appreciationCardData.cardId}
                onSave={() => saveCard(appreciationCardData.cardId)}
                onShare={() => shareCard(appreciationCardData.cardId)}
                onWhatsApp={() => whatsAppShare(appreciationCardData.cardId)}
              />

              {/* Done */}
              <button
                onClick={() => setLocation("/home")}
                className="w-full h-12 rounded-xl bg-primary text-white font-bold text-sm"
              >
                Done
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
