import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pill, Plus, X, Check, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { getMedicationStore, addMedicationSchedule, updateMedicationStatus, type MedicationSchedule } from "@/lib/medication-store";

function generateId(): string {
  return `med-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const PRESET_SCHEDULES = [
  { label: "1-0-1 (Morning + Night)", times: ["08:00", "20:00"] },
  { label: "0-1-0 (Afternoon)", times: ["14:00"] },
  { label: "1-1-1 (Three times daily)", times: ["08:00", "14:00", "20:00"] },
  { label: "Every 8 hours", times: ["06:00", "14:00", "22:00"] },
  { label: "Once daily (Morning)", times: ["08:00"] },
  { label: "Once daily (Night)", times: ["21:00"] },
];

export function MedicationManager() {
  const [schedules, setSchedules] = useState<MedicationSchedule[]>([]);
  const [showForm, setShowForm] = useState(false);

  const [drugName, setDrugName] = useState("");
  const [dosage, setDosage] = useState("");
  const [selectedSchedule, setSelectedSchedule] = useState(PRESET_SCHEDULES[0]!);
  const [duration, setDuration] = useState("");
  const [instructions, setInstructions] = useState("");

  const refresh = () => {
    setSchedules(getMedicationStore().schedules);
  };

  useEffect(() => { refresh(); }, []);

  const handleAdd = () => {
    if (!drugName.trim()) return;
    const schedule: MedicationSchedule = {
      id: generateId(),
      drugName: drugName.trim(),
      dosage: dosage.trim(),
      schedule: selectedSchedule.label,
      duration: duration.trim(),
      startDate: new Date().toISOString().split("T")[0],
      endDate: null,
      instructions: instructions.trim() || null,
      reminderTimes: selectedSchedule.times,
      status: "active",
      createdAt: new Date().toISOString(),
      source: "manual",
      prescriptionId: null,
    };
    addMedicationSchedule(schedule);
    setDrugName("");
    setDosage("");
    setDuration("");
    setInstructions("");
    setShowForm(false);
    refresh();
  };

  const handleMarkComplete = (id: string) => {
    updateMedicationStatus(id, "completed");
    refresh();
  };

  const active = schedules.filter(s => s.status === "active");
  const completed = schedules.filter(s => s.status === "completed");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pill className="w-4 h-4 text-purple-500" />
          <h3 className="text-sm font-bold text-foreground">Medications</h3>
          <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{active.length} active</span>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <input value={drugName} onChange={e => setDrugName(e.target.value)}
                placeholder="Medicine name"
                className="w-full h-11 px-4 bg-muted/50 border border-border rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
              <div className="flex gap-2">
                <input value={dosage} onChange={e => setDosage(e.target.value)}
                  placeholder="Dosage (e.g. 500mg)"
                  className="flex-1 h-11 px-4 bg-muted/50 border border-border rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                <input value={duration} onChange={e => setDuration(e.target.value)}
                  placeholder="Duration (e.g. 7 days)"
                  className="flex-1 h-11 px-4 bg-muted/50 border border-border rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Schedule</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {PRESET_SCHEDULES.map(s => (
                    <button key={s.label} onClick={() => setSelectedSchedule(s)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        selectedSchedule.label === s.label
                          ? "bg-primary/10 text-primary border-primary/20"
                          : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/50"
                      }`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <input value={instructions} onChange={e => setInstructions(e.target.value)}
                placeholder="Instructions (e.g. After meals)"
                className="w-full h-11 px-4 bg-muted/50 border border-border rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
              <div className="flex gap-2">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-border rounded-xl text-sm font-semibold text-muted-foreground">
                  Cancel
                </button>
                <button onClick={handleAdd} disabled={!drugName.trim()}
                  className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-bold disabled:opacity-40">
                  Add Medication
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {active.length === 0 && !showForm && (
        <div className="bg-card border border-border rounded-2xl p-4 text-center">
          <p className="text-sm text-muted-foreground">No active medications</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Add a medication to start tracking</p>
        </div>
      )}

      <div className="space-y-2">
        {active.map(med => (
          <MedicationCard key={med.id} schedule={med} onComplete={handleMarkComplete} />
        ))}
      </div>

      {completed.length > 0 && (
        <details className="group">
          <summary className="text-xs font-semibold text-muted-foreground cursor-pointer flex items-center gap-1 py-1">
            Completed ({completed.length})
            <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
          </summary>
          <div className="space-y-1.5 mt-2">
            {completed.map(med => (
              <div key={med.id} className="bg-muted/30 border border-border rounded-xl px-3 py-2 flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground line-through">{med.drugName}</p>
                  <p className="text-[10px] text-muted-foreground/50">{med.dosage} · {med.schedule}</p>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function MedicationCard({ schedule, onComplete }: { schedule: MedicationSchedule; onComplete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  const nextTime = schedule.reminderTimes
    .map(t => ({ time: t, diff: new Date().getTime() - new Date(`${new Date().toISOString().split("T")[0]}T${t}`).getTime() }))
    .filter(t => t.diff < 0)
    .sort((a, b) => a.diff - b.diff)[0];

  return (
    <motion.div layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center flex-shrink-0">
            <Pill className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">{schedule.drugName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {schedule.dosage}{schedule.dosage ? " · " : ""}{schedule.schedule}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {nextTime && (
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded-full flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {nextTime.time}
              </span>
            )}
            <button onClick={() => setExpanded(!expanded)}
              className="w-7 h-7 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors">
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden">
              <div className="mt-3 pt-3 border-t border-border space-y-2">
                {schedule.duration && (
                  <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Duration:</span> {schedule.duration}</p>
                )}
                {schedule.instructions && (
                  <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Instructions:</span> {schedule.instructions}</p>
                )}
                {schedule.startDate && (
                  <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Started:</span> {new Date(schedule.startDate).toLocaleDateString()}</p>
                )}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => onComplete(schedule.id)}
                    className="flex-1 py-2 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-xl text-xs font-bold hover:bg-emerald-500/20 transition-colors">
                    Mark complete
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
