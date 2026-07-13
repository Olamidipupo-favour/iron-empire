// ============================================================
// Iron Empire — Shared API Types
// ============================================================

export type PhysiqueTier = 'Novice' | 'Athlete' | 'V-Taper';

export type BodyType = 'skinny' | 'fat' | 'skinny-fat' | 'fit';

export type SplitType = 'Chest & Triceps' | 'Back & Biceps' | 'Legs' | 'Shoulders & Core' | 'Full Body' | 'Active Recovery' | 'Rest';

export type CircuitType = 'standard' | 'friday_modified';

export type UserProfile = {
  username: string;
  currentWeightKg: number;
  muscleMass: number;
  physiqueTier: PhysiqueTier;
  bodyType: BodyType;
  currentStreak: number;
  lastLoginDate: string | null;
  lastMealLogDate: string | null;
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
  dailySplit: SplitType;
  dailyTip: string;
  mealLoggedToday: boolean;
};

export type WorkoutSubmitRequest = {
  score: number;
  circuitType: CircuitType;
};

export type MealLogRequest = {
  proteinHit: boolean;
};

export type MealLogResponse = {
  success: boolean;
  message: string;
  growthApplied: boolean;
  weightDelta: number;
  muscleDelta: number;
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
