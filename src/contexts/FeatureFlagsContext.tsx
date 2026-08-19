import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getUserFeatures } from '../lib/database';

type FeatureFlags = Record<string, boolean>;

const FeatureFlagsContext = createContext<FeatureFlags>({});

export function FeatureFlagsProvider({
  children,
  userId,
}: {
  children: ReactNode;
  userId: string | undefined;
}) {
  const [flags, setFlags] = useState<FeatureFlags>({});

  useEffect(() => {
    if (!userId) return;
    getUserFeatures(userId)
      .then(setFlags)
      .catch((e) => console.error('Failed to load feature flags:', e));
  }, [userId]);

  return (
    <FeatureFlagsContext.Provider value={flags}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

/** Returns true/false for a given feature. Defaults to false if not loaded yet. */
export const useFeatureFlag = (featureId: string): boolean => {
  return useContext(FeatureFlagsContext)[featureId] ?? false;
};

/** Returns the full flags map — use when you need multiple flags at once. */
export const useFeatureFlags = (): FeatureFlags => {
  return useContext(FeatureFlagsContext);
};