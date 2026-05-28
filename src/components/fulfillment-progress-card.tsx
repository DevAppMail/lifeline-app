import { motion } from "framer-motion";
import {
  UserCheck, Navigation, MapPin, ClipboardCheck, Heart,
  XCircle, UserX, AlertCircle, Users,
} from "lucide-react";
import type { FulfillmentProgressionState, DonorProgression, FulfillmentProgress } from "@/lib/fulfillment-progression";
import { PROGRESSION_LABELS, PROGRESSION_ORDER } from "@/lib/fulfillment-progression";
import { LEGAL_OPERATIONAL_NOTE, DONOR_PROGRESSION_NOTE } from "@/lib/fulfillment-progression";

const STATE_ICONS: Record<FulfillmentProgressionState, React.ReactNode> = {
  donor_secured:         <UserCheck className="w-4 h-4" />,
  donor_en_route:       <Navigation className="w-4 h-4" />,
  donor_arrived:        <MapPin className="w-4 h-4" />,
  donor_medically_screened: <ClipboardCheck className="w-4 h-4" />,
  donation_completed:   <Heart className="w-4 h-4" />,
  donor_medically_rejected: <AlertCircle className="w-4 h-4" />,
  donor_cancelled:      <XCircle className="w-4 h-4" />,
  donor_no_show:        <UserX className="w-4 h-4" />,
};

const COMPLETED_STATES: FulfillmentProgressionState[] = [
  "donor_secured",
  "donor_en_route",
  "donor_arrived",
  "donor_medically_screened",
  "donation_completed",
];

const TERMINAL_STATES: FulfillmentProgressionState[] = [
  "donation_completed",
  "donor_medically_rejected",
  "donor_cancelled",
  "donor_no_show",
];

function getStateGroup(state: FulfillmentProgressionState): "progress" | "complete" | "terminal" {
  if (state === "donation_completed") return "complete";
  if (TERMINAL_STATES.includes(state)) return "terminal";
  return "progress";
}

function StateIndicator({ state, count }: { state: FulfillmentProgressionState; count: number }) {
  const group = getStateGroup(state);
  const meta = PROGRESSION_LABELS[state];

  const dotColor = group === "complete"
    ? "bg-emerald-500"
    : group === "terminal"
    ? "bg-amber-400"
    : "bg-blue-500";

  const textColor = group === "complete"
    ? "text-emerald-700 dark:text-emerald-400"
    : group === "terminal"
    ? "text-amber-700 dark:text-amber-400"
    : "text-blue-700 dark:text-blue-400";

  return (
    <div className="flex items-center gap-2.5">
      <div className={`w-2 h-2 rounded-full ${dotColor} flex-shrink-0`} />
      <span className={`text-xs font-medium ${textColor}`}>
        {count} {meta.label.toLowerCase()}{count !== 1 ? "" : ""}
      </span>
    </div>
  );
}

function DonorListItem({ donor }: { donor: DonorProgression }) {
  const meta = PROGRESSION_LABELS[donor.state];
  const isToday = new Date(donor.updatedAt).toDateString() === new Date().toDateString();

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 py-2"
    >
      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-bold text-foreground">
          {donor.donorName.charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground truncate">{donor.donorName}</p>
          {isToday && <span className="text-[10px] text-primary font-medium">today</span>}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`text-xs ${meta.color}`}>{meta.label}</span>
        </div>
      </div>
    </motion.div>
  );
}

export function FulfillmentProgressCard({ progress }: { progress: FulfillmentProgress }) {
  const hasDonors = progress.donors.length > 0;
  const terminalDonors = progress.donors.filter((d) => TERMINAL_STATES.includes(d.state));
  const completedCount = progress.states.donation_completed;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-border">
        <h3 className="text-sm font-bold text-foreground">Fulfillment Progress</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Required: {progress.required} donor{progress.required > 1 ? "s" : ""}
          {completedCount > 0 && (
            <span className="text-emerald-600 font-medium">
              {" · "}{completedCount} successful
            </span>
          )}
        </p>
      </div>

      {/* State summary */}
      <div className="p-5 space-y-2">
        {PROGRESSION_ORDER.map((state) => {
          const count = progress.states[state];
          if (count === 0) return null;
          return <StateIndicator key={state} state={state} count={count} />;
        })}

        {!hasDonors && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Users className="w-4 h-4" />
            <span>Awaiting donor responses</span>
          </div>
        )}
      </div>

      {/* Individual donor list */}
      {hasDonors && (
        <div className="px-5 pb-2">
          <div className="border-t border-border pt-3 space-y-1">
            {progress.donors.map((donor) => (
              <DonorListItem key={donor.donorId} donor={donor} />
            ))}
          </div>
        </div>
      )}

      {/* Terminal state note */}
      {terminalDonors.length > 0 && completedCount === 0 && (
        <div className="mx-5 mb-4 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {terminalDonors.length} donor{terminalDonors.length > 1 ? "s" : ""} could not complete donation.
          </p>
        </div>
      )}

      {/* Operational note */}
      <div className="px-5 pb-4">
        <div className="bg-muted/50 border border-border rounded-xl p-3">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {DONOR_PROGRESSION_NOTE}
          </p>
        </div>
      </div>
    </div>
  );
}

export function LegalOperationalNote() {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
          <AlertCircle className="w-4 h-4 text-muted-foreground" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
            Important Note
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {LEGAL_OPERATIONAL_NOTE}
          </p>
        </div>
      </div>
    </div>
  );
}
