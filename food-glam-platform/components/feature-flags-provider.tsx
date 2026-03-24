"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { unwrapSupabase } from '@/lib/supabase-utils';

export type FeatureFlags = {
  healthMode?: boolean;
  powerMode?: boolean;
  fasting?: boolean;
  foodLogging?: boolean;
  nutritionComputed?: boolean;
  micronutrients?: boolean;
  pantry?: boolean;
  [key: string]: boolean | undefined;
};

interface FeatureFlagsContextValue {
  flags: FeatureFlags;
  loading: boolean;
  refresh: () => void;
  setOverride?: (key: string, value: boolean | null) => void;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | undefined>(undefined);

export const useFeatureFlags = () => {
  const ctx = useContext(FeatureFlagsContext);
  if (!ctx) throw new Error("useFeatureFlags must be used within FeatureFlagsProvider");
  return ctx;
};

export const FeatureFlagsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [remoteFlags, setRemoteFlags] = useState<FeatureFlags>({});
  const [overrides, setOverrides] = useState<FeatureFlags>({});
  const [loading, setLoading] = useState(true);

  const fetchFlags = async () => {
    setLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (user) {
      const res = await supabase.from("profiles").select("feature_flags").eq("id", user.id).single();
      const { data, error } = unwrapSupabase<any>(res);
      if (!error && data?.feature_flags) setRemoteFlags(data.feature_flags as FeatureFlags);
    }
    setLoading(false);
  };

  // load overrides from localStorage (dev-only)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("ff_overrides");
      if (raw) setOverrides(JSON.parse(raw));
    } catch (e) {
      // ignore
    }
  }, []);

  const setOverride = (key: string, value: boolean | null) => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (value === null) delete next[key];
      else next[key] = value;
      try {
        localStorage.setItem("ff_overrides", JSON.stringify(next));
      } catch (e) {
        // ignore
      }
      return next;
    });
  };

  useEffect(() => {
    fetchFlags();
  }, []);

  const merged = { ...remoteFlags, ...overrides };

  return (
    <FeatureFlagsContext.Provider value={{ flags: merged, loading, refresh: fetchFlags, setOverride }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
};
