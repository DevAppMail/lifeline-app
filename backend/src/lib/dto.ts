export interface AppointmentDTO {
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

export interface ConsultationDTO {
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

export interface PrescriptionItemDTO {
  drugName: string;
  dosage: string;
  duration: string;
  instructions?: string;
}

export interface PrescriptionDTO {
  id: string;
  consultationId: string;
  date: string;
  doctorName: string;
  items: PrescriptionItemDTO[];
}

export interface FollowUpDTO {
  id: string;
  recommendedDate: string;
  reason?: string;
  status: string;
  doctorName?: string;
}

export interface BillingDTO {
  id: string;
  consultationId: string;
  fee: number;
  amountPaid: number;
  pendingAmount: number;
  status: string;
  date: string;
}

export interface PatientContinuityDTO {
  appointments: AppointmentDTO[];
  consultations: ConsultationDTO[];
  prescriptions: PrescriptionDTO[];
  followUps: FollowUpDTO[];
  billing: BillingDTO[];
  summary: {
    totalAppointments: number;
    totalCompleted: number;
    totalSpent: number;
    totalPending: number;
    lastVisitDate?: string;
    nextAppointmentDate?: string;
    pendingFollowUps: number;
  };
}
