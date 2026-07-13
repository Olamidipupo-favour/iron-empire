import { Hono } from 'hono';
import { redis, reddit } from '@devvit/web/server';
import type {
  InitResponse,
  WorkoutSubmitRequest,
  WorkoutSubmitResponse,
  UserProfile,
  CommunityGym,
  MealLogRequest,
  MealLogResponse,
  BodyType,
} from '../../shared/api';
import {
  calculateDecay,
  calculateMissedDays,
  calculateGrowth,
  calculateCommunityPoints,
  calculateStreak,
  determinePhysiqueTier,
  getGymTierLevel,
  getPointsToNextTier,
  getGymTierName,
  getTodayDateString,
  getRandomBodyType,
  getDailySplit,
  getDailyTip,
} from '../core/progression';

type ErrorResponse = {
  status: 'error';
  message: string;
};

export const api = new Hono();

// ---- Helpers ----

const DEFAULTS = {
  weight: 75.0,
  muscle: 15.0,
  streak: 0,
  points: 0,
  tier: 'Novice',
} as const;

/**
 * Load a user profile from Redis, applying decay if they've missed days.
 * Creates a new profile if the user doesn't exist yet.
 */
async function loadUserProfile(username: string): Promise<{
  profile: UserProfile;
  decayApplied: boolean;
  missedDays: number;
}> {
  const key = `users:${username}`;
  const data = await redis.hGetAll(key);

  const today = getTodayDateString();
  const isNewUser = !data || Object.keys(data).length === 0;

  let weight = isNewUser ? DEFAULTS.weight : parseFloat(data.currentWeightKg ?? String(DEFAULTS.weight));
  let muscle = isNewUser ? DEFAULTS.muscle : parseFloat(data.muscleMass ?? String(DEFAULTS.muscle));
  let streak = isNewUser ? DEFAULTS.streak : parseInt(data.currentStreak ?? String(DEFAULTS.streak), 10);
  const totalPoints = isNewUser ? DEFAULTS.points : parseInt(data.totalPoints ?? String(DEFAULTS.points), 10);
  const lastLogin = isNewUser ? null : (data.lastLoginDate ?? null);
  const bodyType = isNewUser ? getRandomBodyType() : (data.bodyType as BodyType ?? 'skinny-fat');
  const lastMealLogDate = isNewUser ? null : (data.lastMealLogDate ?? null);

  // Calculate missed days and apply decay
  const rawDaysSince = lastLogin ? Math.floor((new Date(today).getTime() - new Date(lastLogin).getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const missedDays = calculateMissedDays(lastLogin, today);
  let decayApplied = false;

  if (missedDays > 0) {
    weight = calculateDecay(weight, missedDays);
    muscle = calculateDecay(muscle, missedDays);
    weight = Math.max(weight, 60); // Weight floor
    decayApplied = true;
  }

  // Update streak
  streak = isNewUser ? 0 : calculateStreak(streak, rawDaysSince);

  const tier = determinePhysiqueTier(weight, muscle);

  const updates: Record<string, string> = {
    currentWeightKg: weight.toFixed(2),
    muscleMass: muscle.toFixed(2),
    physiqueTier: tier,
    bodyType,
    currentStreak: String(streak),
    totalPoints: String(totalPoints),
    lastLoginDate: today,
  };
  if (lastMealLogDate) updates.lastMealLogDate = lastMealLogDate;

  // Persist updated profile
  await redis.hSet(key, updates);

  return {
    profile: {
      username,
      currentWeightKg: parseFloat(weight.toFixed(2)),
      muscleMass: parseFloat(muscle.toFixed(2)),
      physiqueTier: tier,
      bodyType,
      currentStreak: streak,
      lastLoginDate: today,
      lastMealLogDate,
      totalPoints,
    },
    decayApplied,
    missedDays,
  };
}

/**
 * Load the community gym state from Redis.
 */
async function loadCommunityGym(): Promise<CommunityGym> {
  const key = 'community_gym';
  const totalPointsStr = await redis.hGet(key, 'totalPoints');
  const totalPoints = totalPointsStr ? parseInt(totalPointsStr, 10) : 0;

  const gymTierLevel = getGymTierLevel(totalPoints);
  const pointsToNextTier = getPointsToNextTier(totalPoints);
  const tierName = getGymTierName(gymTierLevel);

  return {
    totalPoints,
    gymTierLevel,
    pointsToNextTier,
    tierName,
  };
}

// ---- Routes ----

/**
 * GET /api/init
 * Load user profile (with decay calculation) and community gym state.
 */
api.get('/init', async (c) => {
  try {
    const username = await reddit.getCurrentUsername();
    const name = username ?? 'anonymous';

    const { profile, decayApplied, missedDays } = await loadUserProfile(name);
    const gym = await loadCommunityGym();

    const dailySplit = getDailySplit();
    const dailyTip = getDailyTip();
    const mealLoggedToday = profile.lastMealLogDate === getTodayDateString();

    return c.json<InitResponse>({
      type: 'init',
      user: profile,
      gym,
      decayApplied,
      missedDays,
      dailySplit,
      dailyTip,
      mealLoggedToday,
    });
  } catch (error) {
    console.error('API Init Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json<ErrorResponse>(
      { status: 'error', message: `Initialization failed: ${message}` },
      400
    );
  }
});

/**
 * POST /api/workout/submit
 * Submit a workout score. Apply growth if score > 70%, add to community pool.
 */
api.post('/workout/submit', async (c) => {
  try {
    const username = await reddit.getCurrentUsername();
    const name = username ?? 'anonymous';

    const body = await c.req.json<WorkoutSubmitRequest>();
    const { score, circuitType } = body;

    // Validate
    if (typeof score !== 'number' || score < 0 || score > 100) {
      return c.json<ErrorResponse>(
        { status: 'error', message: 'Score must be between 0 and 100' },
        400
      );
    }

    const userKey = `users:${name}`;
    const gymKey = 'community_gym';
    const today = getTodayDateString();

    // Calculate growth
    const { weightDelta, muscleDelta } = calculateGrowth(score);
    const communityPointsEarned = calculateCommunityPoints(score);
    const growthApplied = score > 70;

    const data = await redis.hGetAll(userKey);
    let weight = parseFloat(data?.currentWeightKg ?? String(DEFAULTS.weight));
    let muscle = parseFloat(data?.muscleMass ?? String(DEFAULTS.muscle));
    let streak = parseInt(data?.currentStreak ?? String(DEFAULTS.streak), 10);
    let totalPoints = parseInt(data?.totalPoints ?? String(DEFAULTS.points), 10);
    const bodyType = (data?.bodyType as BodyType) ?? 'skinny-fat';
    const lastMealLogDate = data?.lastMealLogDate ?? null;

    // Apply growth
    if (growthApplied) {
      weight = parseFloat((weight + weightDelta).toFixed(2));
      muscle = parseFloat((muscle + muscleDelta).toFixed(2));
      totalPoints += communityPointsEarned;

      // Increment streak on successful workout
      streak += 1;
    }

    const tier = determinePhysiqueTier(weight, muscle);

    const updates: Record<string, string> = {
      currentWeightKg: weight.toFixed(2),
      muscleMass: muscle.toFixed(2),
      physiqueTier: tier,
      currentStreak: String(streak),
      totalPoints: String(totalPoints),
      lastLoginDate: today,
    };
    if (bodyType) updates.bodyType = bodyType;
    if (lastMealLogDate) updates.lastMealLogDate = lastMealLogDate;

    // Persist user updates
    await redis.hSet(userKey, updates);

    // Add to community gym pool
    if (communityPointsEarned > 0) {
      await redis.hIncrBy(gymKey, 'totalPoints', communityPointsEarned);
    }

    // Log workout in sorted set (score = timestamp for ordering)
    const workoutLog = JSON.stringify({
      score,
      circuitType,
      date: today,
      timestamp: Date.now(),
    });
    await redis.zAdd(`workouts:${name}`, {
      member: workoutLog,
      score: Date.now(),
    });

    // Re-fetch gym for response
    const gym = await loadCommunityGym();

    const profile: UserProfile = {
      username: name,
      currentWeightKg: weight,
      muscleMass: muscle,
      physiqueTier: tier,
      bodyType,
      currentStreak: streak,
      lastLoginDate: today,
      lastMealLogDate,
      totalPoints,
    };

    return c.json<WorkoutSubmitResponse>({
      type: 'workout_result',
      user: profile,
      gym,
      weightDelta,
      muscleDelta,
      communityPointsEarned,
      growthApplied,
    });
  } catch (error) {
    console.error('Workout Submit Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json<ErrorResponse>(
      { status: 'error', message: `Workout submission failed: ${message}` },
      400
    );
  }
});

/**
 * POST /api/meal/log
 * Log daily nutrition and grant a small growth boost if protein hit.
 */
api.post('/meal/log', async (c) => {
  try {
    const username = await reddit.getCurrentUsername();
    const name = username ?? 'anonymous';
    const body = await c.req.json<MealLogRequest>();
    
    if (!body.proteinHit) {
      return c.json<MealLogResponse>({
        success: true,
        message: 'Meal logged without protein hit.',
        growthApplied: false,
        weightDelta: 0,
        muscleDelta: 0
      });
    }

    const userKey = `users:${name}`;
    const today = getTodayDateString();
    const data = await redis.hGetAll(userKey);
    
    if (data?.lastMealLogDate === today) {
      return c.json<ErrorResponse>({ status: 'error', message: 'Meal already logged today' }, 400);
    }

    let weight = parseFloat(data?.currentWeightKg ?? String(DEFAULTS.weight));
    let muscle = parseFloat(data?.muscleMass ?? String(DEFAULTS.muscle));
    
    const weightDelta = 0.05;
    const muscleDelta = 0.1;
    weight += weightDelta;
    muscle += muscleDelta;
    const tier = determinePhysiqueTier(weight, muscle);

    await redis.hSet(userKey, {
      currentWeightKg: weight.toFixed(2),
      muscleMass: muscle.toFixed(2),
      physiqueTier: tier,
      lastMealLogDate: today
    });

    return c.json<MealLogResponse>({
      success: true,
      message: 'Protein hit! Stats increased.',
      growthApplied: true,
      weightDelta,
      muscleDelta
    });
  } catch (error) {
    console.error('Meal Log Error:', error);
    return c.json<ErrorResponse>({ status: 'error', message: 'Failed to log meal' }, 400);
  }
});
