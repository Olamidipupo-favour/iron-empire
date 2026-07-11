// ============================================================
// Iron Empire — Shared API Types
// ============================================================

export type PhysiqueTier = 'Novice' | 'Athlete' | 'V-Taper';

export type CircuitType = 'standard' | 'friday_modified';

export type UserProfile = {
  username: string;
  currentWeightKg: number;
  muscleMass: number;
  physiqueTier: PhysiqueTier;
  currentStreak: number;
  lastLoginDate: string | null;
  totalPoints: number;
};

export type CommunityGym = {
  totalPoints: number;
  gymTierLevel: number;
  pointsToNextTier: number;
  tierName: string;
};

export type InitResponse = {
  type: 'init';
  user: UserProfile;
  gym: CommunityGym;
  decayApplied: boolean;
  missedDays: number;
};

export type WorkoutSubmitRequest = {
  score: number;
  circuitType: CircuitType;
};

export type WorkoutSubmitResponse = {
  type: 'workout_result';
  user: UserProfile;
  gym: CommunityGym;
  weightDelta: number;
  muscleDelta: number;
  communityPointsEarned: number;
  growthApplied: boolean;
};
