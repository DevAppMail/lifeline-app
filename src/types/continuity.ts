export type ContinuityEntityType =
  | "appointment"
  | "consultation"
  | "prescription"
  | "follow_up"
  | "billing";

export interface ContinuityAppointment {
  id: string;
  doctorName: string;
  doctorSpecialty: string;
  clinicName: string;
  date: string;
  time: string;
  status: string;
  reason?: string;
  appointmentSource: string;
  canCancel: boolean;
}

export interface ContinuityConsultation {
  id: string;
  appointmentId: string;
  date: string;
  doctorName: string;
  diagnosis?: string;
  notes?: string;
  vitals?: {
    bloodPressure?: string;
    heartRate?: number;
    temperature?: number;
    weight?: number;
  };
}

export interface PrescriptionItem {
  drugName: string;
  dosage: string;
  duration: string;
  instructions?: string;
}

export interface ContinuityPrescription {
  id: string;
  consultationId: string;
  date: string;
  doctorName: string;
  items: PrescriptionItem[];
}

export interface ContinuityFollowUp {
  id: string;
  recommendedDate: string;
  reason?: string;
  status: string;
  doctorName?: string;
}

export interface ContinuityBilling {
  id: string;
  consultationId: string;
  fee: number;
  amountPaid: number;
  pendingAmount: number;
  status: string;
  date: string;
}

export interface ContinuitySummary {
  totalAppointments: number;
  totalCompleted: number;
  totalSpent: number;
  totalPending: number;
  lastVisitDate?: string;
  nextAppointmentDate?: string;
  pendingFollowUps: number;
}

export interface PatientContinuity {
  appointments: ContinuityAppointment[];
  consultations: ContinuityConsultation[];
  prescriptions: ContinuityPrescription[];
  followUps: ContinuityFollowUp[];
  billing: ContinuityBilling[];
  summary: ContinuitySummary;
}

export interface NormalizedContinuityEvent {
  id: string;
  type: ContinuityEntityType;
  date: string;
  sortKey: string;
  data:
    | ContinuityAppointment
    | ContinuityConsultation
    | ContinuityPrescription
    | ContinuityFollowUp
    | ContinuityBilling;
}
