import { useState, useEffect, useCallback } from "react";
import type { PatientContinuity, ContinuityEntityType } from "@/types/continuity";
import { useProfile } from "@/context/profile-context";

interface UseContinuityOptions {
  enabled?: boolean;
  types?: ContinuityEntityType[];
}

interface UseContinuityResult {
  data: PatientContinuity | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const EMPTY: PatientContinuity = {
  appointments: [],
  consultations: [],
  prescriptions: [],
  followUps: [],
  billing: [],
  summary: {
    totalAppointments: 0,
    totalCompleted: 0,
    totalSpent: 0,
    totalPending: 0,
    pendingFollowUps: 0,
  },
};

export function useContinuity(options: UseContinuityOptions = {}): UseContinuityResult {
  const { bffFetch } = useProfile();
  const [data, setData] = useState<PatientContinuity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContinuity = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await bffFetch("/api/app/continuity");
      if (!res.ok) {
        if (res.status === 400) {
          setData(null);
          setError(null);
          return;
        }
        throw new Error(`Continuity API error: ${res.status}`);
      }
      const json = await res.json() as PatientContinuity;
      if (options.types) {
        setData({
          ...json,
          appointments: options.types.includes("appointment") ? json.appointments : [],
          consultations: options.types.includes("consultation") ? json.consultations : [],
          prescriptions: options.types.includes("prescription") ? json.prescriptions : [],
          followUps: options.types.includes("follow_up") ? json.followUps : [],
          billing: options.types.includes("billing") ? json.billing : [],
        });
      } else {
        setData(json);
      }
    } catch {
      setData(EMPTY);
      setError("Continuity data unavailable");
    }
    setLoading(false);
  }, [bffFetch, options.types?.join(",")]);

  useEffect(() => {
    if (options.enabled !== false) {
      fetchContinuity();
    }
  }, [fetchContinuity, options.enabled]);

  return { data, loading, error, refetch: fetchContinuity };
}
