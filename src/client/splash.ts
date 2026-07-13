import { requestExpandedMode, context } from '@devvit/web/client';
import type { InitResponse } from '../shared/api';

// ---- DOM Elements ----

const loadingContainer = document.getElementById('loading-container') as HTMLDivElement;
const dashboard = document.getElementById('dashboard') as HTMLDivElement;
const greeting = document.getElementById('greeting') as HTMLParagraphElement;
const decayAlert = document.getElementById('decay-alert') as HTMLDivElement;
const decayText = document.getElementById('decay-text') as HTMLSpanElement;
const avatarImage = document.getElementById('avatar-image') as HTMLImageElement;
const tierBadge = document.getElementById('tier-badge') as HTMLSpanElement;
const streakFlame = document.getElementById('streak-flame') as HTMLDivElement;
const streakValue = document.getElementById('streak-value') as HTMLSpanElement;
const weightFill = document.getElementById('weight-fill') as HTMLDivElement;
const weightCurrent = document.getElementById('weight-current') as HTMLSpanElement;
const muscleFill = document.getElementById('muscle-fill') as HTMLDivElement;
const muscleCurrent = document.getElementById('muscle-current') as HTMLSpanElement;
const pointsValue = document.getElementById('points-value') as HTMLSpanElement;
const gymTierBadge = document.getElementById('gym-tier-badge') as HTMLSpanElement;
const gymName = document.getElementById('gym-name') as HTMLDivElement;
const gymFill = document.getElementById('gym-fill') as HTMLDivElement;
const gymPoints = document.getElementById('gym-points') as HTMLSpanElement;
const gymNext = document.getElementById('gym-next') as HTMLSpanElement;
const startButton = document.getElementById('start-button') as HTMLButtonElement;
const dailySplit = document.getElementById('daily-split') as HTMLSpanElement;
const dailyTip = document.getElementById('daily-tip') as HTMLSpanElement;
const mealStatus = document.getElementById('meal-status') as HTMLSpanElement;
const logMealButton = document.getElementById('log-meal-button') as HTMLButtonElement;

// ---- Constants ----

const WEIGHT_GOAL = 87.0;
const WEIGHT_MIN = 60.0;
const MUSCLE_GOAL = 45.0;
const MUSCLE_MIN = 5.0;

// ---- Helpers ----

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function setProgressBar(fill: HTMLDivElement, current: number, min: number, max: number): void {
  const range = max - min;
  const pct = Math.max(0, Math.min(100, ((current - min) / range) * 100));
  // Delay to trigger CSS transition
  requestAnimationFrame(() => {
    fill.style.width = `${pct}%`;
  });
}

function getTierCssClass(tier: string): string {
  switch (tier) {
    case 'V-Taper': return 'vtaper';
    case 'Athlete': return 'athlete';
    default: return 'novice';
  }
}

// ---- Populate Dashboard ----

function populateDashboard(data: InitResponse): void {
  const { user, gym, decayApplied, missedDays } = data;

  // Greeting
  const username = user.username === 'anonymous' ? 'Warrior' : user.username;
  greeting.textContent = `Welcome back, ${username}`;

  // Decay warning
  if (decayApplied && missedDays > 0) {
    decayAlert.style.display = 'flex';
    decayText.textContent = `You missed ${missedDays} day${missedDays > 1 ? 's' : ''}! Stats decayed — get back on track!`;
  }

  // Tier badge & Avatar
  const tierClass = getTierCssClass(user.physiqueTier);
  tierBadge.textContent = user.physiqueTier;
  tierBadge.className = `tier-badge ${tierClass}`;
  avatarImage.src = `assets/avatar_${tierClass}.png`;
  avatarImage.className = `avatar-image ${tierClass}`;

  // Streak
  streakValue.textContent = String(user.currentStreak);
  if (user.currentStreak > 0) {
    streakFlame.classList.add('streak-active');
  }

  // Weight progress
  weightCurrent.textContent = `${user.currentWeightKg.toFixed(1)} kg`;
  setProgressBar(weightFill, user.currentWeightKg, WEIGHT_MIN, WEIGHT_GOAL);

  // Muscle progress
  muscleCurrent.textContent = user.muscleMass.toFixed(1);
  setProgressBar(muscleFill, user.muscleMass, MUSCLE_MIN, MUSCLE_GOAL);

  // Points
  pointsValue.textContent = formatNumber(user.totalPoints);

  // Community gym
  gymTierBadge.textContent = `Tier ${gym.gymTierLevel}`;
  gymName.textContent = gym.tierName;
  gymPoints.textContent = `${formatNumber(gym.totalPoints)} pts`;

  if (gym.pointsToNextTier > 0) {
    gymNext.textContent = `${formatNumber(gym.pointsToNextTier)} pts to next tier`;
    // Calculate fill: points within current tier band
    const currentTierStart = gym.totalPoints - (gym.totalPoints % (gym.pointsToNextTier + gym.totalPoints));
    const tierBand = gym.pointsToNextTier + (gym.totalPoints - currentTierStart);
    const pctInTier = tierBand > 0 ? ((gym.totalPoints - currentTierStart) / tierBand) * 100 : 0;
    requestAnimationFrame(() => {
      gymFill.style.width = `${Math.min(100, Math.max(3, pctInTier))}%`;
    });
  } else {
    gymNext.textContent = 'Max tier reached!';
    requestAnimationFrame(() => {
      gymFill.style.width = '100%';
    });
  }

  // Daily Split and Tip
  dailySplit.textContent = data.dailySplit;
  dailyTip.textContent = data.dailyTip;

  // Meal Status
  if (data.mealLoggedToday) {
    mealStatus.textContent = 'Completed';
    mealStatus.className = 'status-badge completed';
    logMealButton.disabled = true;
    logMealButton.style.opacity = '0.5';
    logMealButton.style.cursor = 'not-allowed';
    logMealButton.innerHTML = '<span class="action-icon">✅</span><span class="action-text">Protein Hit!</span>';
  } else {
    mealStatus.textContent = 'Pending';
    mealStatus.className = 'status-badge pending';
    logMealButton.disabled = false;
    logMealButton.style.opacity = '1';
    logMealButton.style.cursor = 'pointer';
    logMealButton.innerHTML = '<span class="action-icon">🥩</span><span class="action-text">Log Protein Hit</span>';
  }

  // Show dashboard, hide loading
  loadingContainer.style.display = 'none';
  dashboard.style.display = 'flex';
}

// ---- Fallback/Error State ----

function showFallbackDashboard(): void {
  // Show dashboard with defaults when API fails
  const username = context.username ?? 'Warrior';
  greeting.textContent = `Welcome, ${username}`;
  tierBadge.textContent = 'Novice';
  tierBadge.className = 'tier-badge novice';
  avatarImage.src = 'assets/avatar_novice.png';
  avatarImage.className = 'avatar-image novice';
  streakValue.textContent = '0';
  weightCurrent.textContent = '75.0 kg';
  muscleCurrent.textContent = '15.0';
  pointsValue.textContent = '0';
  gymTierBadge.textContent = 'Tier 1';
  gymName.textContent = 'Garage Gym';
  gymPoints.textContent = '0 pts';
  gymNext.textContent = '1,000 pts to next tier';

  setProgressBar(weightFill, 75, WEIGHT_MIN, WEIGHT_GOAL);
  setProgressBar(muscleFill, 15, MUSCLE_MIN, MUSCLE_GOAL);
  requestAnimationFrame(() => {
    gymFill.style.width = '3%';
  });

  loadingContainer.style.display = 'none';
  dashboard.style.display = 'flex';
}

// ---- Event Listeners ----

startButton.addEventListener('click', (e) => {
  requestExpandedMode(e, 'game');
});

logMealButton.addEventListener('click', async () => {
  if (logMealButton.disabled) return;
  
  logMealButton.disabled = true;
  logMealButton.innerHTML = '<span class="action-text">Logging...</span>';

  try {
    const response = await fetch('/api/meal/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proteinHit: true })
    });
    
    if (!response.ok) throw new Error('Failed to log meal');
    
    // Refresh dashboard to show new stats and completed status
    await init();
  } catch (err) {
    console.error(err);
    logMealButton.disabled = false;
    logMealButton.innerHTML = '<span class="action-icon">🥩</span><span class="action-text">Log Protein Hit</span>';
  }
});

// ---- Init ----

async function init(): Promise<void> {
  try {
    const response = await fetch('/api/init');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json() as InitResponse;
    populateDashboard(data);
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
    showFallbackDashboard();
  }
}

void init();
