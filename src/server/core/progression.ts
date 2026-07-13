// ============================================================
// Iron Empire — Progression & Decay Logic (Pure Functions)
// ============================================================

import type { PhysiqueTier, BodyType, SplitType } from '../../shared/api';

// Decay constant λ — controls how aggressively stats decay per missed day
const DECAY_LAMBDA = 0.05;

// Gym tier thresholds: cumulative community points needed for each level
const GYM_TIER_THRESHOLDS = [0, 1000, 5000, 15000, 50000, 150000] as const;

const GYM_TIER_NAMES = [
  'Garage Gym',       // Tier 1
  'Community Center',  // Tier 2
  'Local Gym',         // Tier 3
  'Fitness Complex',   // Tier 4
  'Elite Arena',       // Tier 5
  'Iron Temple',       // Tier 6
] as const;

// ---- Generators & Daily Mechanics ----

export const getRandomBodyType = (): BodyType => {
  const types: BodyType[] = ['skinny', 'fat', 'skinny-fat'];
  return types[Math.floor(Math.random() * types.length)] ?? 'skinny-fat';
};

export const getDailySplit = (dateString?: string): SplitType => {
  const date = dateString ? new Date(dateString) : new Date();
  const day = date.getDay(); // 0 = Sunday, 1 = Monday, ...
  
  switch (day) {
    case 1: return 'Chest & Triceps';
    case 2: return 'Back & Biceps';
    case 3: return 'Active Recovery';
    case 4: return 'Legs';
    case 5: return 'Shoulders & Core';
    case 6: return 'Full Body';
    case 0: return 'Rest';
    default: return 'Full Body';
  }
};

const HEALTH_TIPS = [
  "Protein synthesis peaks within 24 hours of training. Hit your macros!",
  "Sleep is when the body builds muscle. Aim for 7-9 hours.",
  "Progressive overload is the key to growth. Lift slightly heavier or do more reps.",
  "Hydration affects strength. Drink water before, during, and after your workout.",
  "Compound exercises like squats and deadlifts release more growth hormone.",
  "Don't neglect mobility! Stretching prevents injury and improves form.",
  "Carbs are energy. Don't fear them around your workout window.",
  "Consistency beats intensity. Showing up on the days you don't want to builds discipline.",
  "A caloric surplus is needed to build muscle, but don't dirty bulk. Eat clean!",
  "Active recovery reduces lactic acid buildup faster than complete rest."
];

export const getDailyTip = (): string => {
  const today = new Date();
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24);
  const tip = HEALTH_TIPS[dayOfYear % HEALTH_TIPS.length];
  return tip !== undefined ? tip : HEALTH_TIPS[0]!;
};

// ---- Decay ----

/**
 * Applies exponential decay to a stat value after missed days.
 *
 * Formula: S_t = S_0 * e^(-λ * t)
 *
 * Where S_0 is the current stat, t is missed days, and λ is the decay constant.
 * R(τ) = 0 since no workouts were performed during missed days.
 *
 * @param currentStat - The stat value before decay (S_0)
 * @param missedDays  - Number of days missed (t), must be > 0
 * @param lambda      - Decay constant, defaults to 0.05
 * @returns The decayed stat value (S_t), clamped to a minimum floor
 */
export const calculateDecay = (
  currentStat: number,
  missedDays: number,
  lambda: number = DECAY_LAMBDA
): number => {
  if (missedDays <= 0) return currentStat;

  // S_t = S_0 * e^(-λ * t)
  const decayed = currentStat * Math.exp(-lambda * missedDays);

  // Floor: weight can't drop below 60kg, muscle can't drop below 5
  return Math.max(decayed, 5);
};

/**
 * Calculates the number of days between two date strings (YYYY-MM-DD).
 * Returns 0 if same day, 1 if consecutive days, etc.
 */
export const calculateMissedDays = (
  lastLoginDate: string | null,
  currentDate: string
): number => {
  if (!lastLoginDate) return 0; // First login, no decay

  const last = new Date(lastLoginDate);
  const current = new Date(currentDate);
  const diffMs = current.getTime() - last.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays - 1); // 1 day gap = 0 missed (consecutive)
};

// ---- Growth ----

/**
 * Calculates stat growth from a workout score.
 *
 * Growth only applies if score > 70%.
 *
 * @param score        - Accuracy percentage (0-100)
 * @param currentWeight - Current weight in kg
 * @param currentMuscle - Current muscle mass
 * @returns Object with weight and muscle deltas
 */
export const calculateGrowth = (
  score: number
): { weightDelta: number; muscleDelta: number } => {
  if (score <= 70) {
    return { weightDelta: 0, muscleDelta: 0 };
  }

  const scoreRatio = score / 100;

  return {
    weightDelta: parseFloat((0.15 * scoreRatio).toFixed(3)),
    muscleDelta: parseFloat((0.3 * scoreRatio).toFixed(3)),
  };
};

// ---- Physique Tier ----

/**
 * Determines the physique tier based on current stats.
 *
 * Thresholds:
 *   Novice  → default
 *   Athlete → weight ≥ 80 AND muscle ≥ 30
 *   V-Taper → weight ≥ 87 AND muscle ≥ 45
 */
export const determinePhysiqueTier = (
  weight: number,
  muscle: number
): PhysiqueTier => {
  if (weight >= 87 && muscle >= 45) return 'V-Taper';
  if (weight >= 80 && muscle >= 30) return 'Athlete';
  return 'Novice';
};

// ---- Community Gym ----

/**
 * Calculates community points earned from a workout score.
 * Points are only awarded if score > 70.
 */
export const calculateCommunityPoints = (score: number): number => {
  if (score <= 70) return 0;
  return Math.floor(score * 0.5);
};

/**
 * Determines the gym tier level based on total accumulated points.
 */
export const getGymTierLevel = (totalPoints: number): number => {
  let level = 1;
  for (let i = GYM_TIER_THRESHOLDS.length - 1; i >= 0; i--) {
    const threshold = GYM_TIER_THRESHOLDS[i];
    if (threshold !== undefined && totalPoints >= threshold) {
      level = i + 1;
      break;
    }
  }
  return Math.min(level, GYM_TIER_NAMES.length);
};

/**
 * Calculates points remaining until the next gym tier.
 * Returns 0 if already at max tier.
 */
export const getPointsToNextTier = (totalPoints: number): number => {
  for (const threshold of GYM_TIER_THRESHOLDS) {
    if (totalPoints < threshold) {
      return threshold - totalPoints;
    }
  }
  return 0; // Max tier reached
};

/**
 * Gets the display name for a gym tier level.
 */
export const getGymTierName = (level: number): string => {
  const idx = Math.max(0, Math.min(level - 1, GYM_TIER_NAMES.length - 1));
  return GYM_TIER_NAMES[idx] ?? 'Garage Gym';
};

// ---- Streak ----

/**
 * Calculates the updated streak value based on days since last login.
 *
 * - Same day (0): keep current streak
 * - Next day (1): increment streak
 * - More than 1 day gap: reset to 1
 */
export const calculateStreak = (
  currentStreak: number,
  daysSinceLastLogin: number
): number => {
  if (daysSinceLastLogin === 0) return currentStreak;
  if (daysSinceLastLogin === 1) return currentStreak + 1;
  return 1; // Reset on gap > 1 day
};

/**
 * Gets today's date as YYYY-MM-DD string.
 */
export const getTodayDateString = (): string => {
  const parts = new Date().toISOString().split('T');
  return parts[0] ?? new Date().toISOString().slice(0, 10);
};
