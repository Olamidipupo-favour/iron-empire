import { Scene } from 'phaser';
import * as Phaser from 'phaser';

// ---- Types ----

type CueSprite = Phaser.GameObjects.Image & {
  lane: number;
  scored: boolean;
};

type HitRating = 'perfect' | 'good' | 'ok' | 'miss';

// ---- Constants ----

const BASE_DROP_SPEED = 200; // px/s
const TARGET_ZONE_Y_RATIO = 0.8; // 80% down the screen
const CUE_COUNT_STANDARD = 30;
const CUE_COUNT_FRIDAY = 45;
const FRIDAY_SPEED_MULTIPLIER = 1.5;
const MISS_PENALTY_FRIDAY = 3;

const HIT_THRESHOLDS = {
  perfect: 15,
  good: 30,
  ok: 50,
} as const;

const HIT_SCORES = {
  perfect: 10,
  good: 7,
  ok: 4,
  miss: 0,
} as const;

/**
 * WorkoutScene: The rhythm/timing-based minigame.
 *
 * Cues (dumbbells/plates) fall from top to a target zone.
 * Player taps when the cue reaches the zone for accuracy points.
 *
 * Friday Modified Circuit:
 *   - Dual lanes
 *   - 1.5x speed
 *   - 45 cues
 *   - Strict miss penalty
 */
export class WorkoutScene extends Scene {
  // State
  private activeCues: CueSprite[] = [];
  private totalCues: number = CUE_COUNT_STANDARD;
  private spawnedCount: number = 0;
  private hitCount: number = 0;
  private missCount: number = 0;
  private rawScore: number = 0;
  private maxPossibleScore: number = 0;
  private isFridayCircuit: boolean = false;
  private dropSpeed: number = BASE_DROP_SPEED;
  private targetZoneY: number = 0;
  private lanes: number[] = [];
  private isCountingDown: boolean = true;
  private isComplete: boolean = false;

  // UI Elements
  private scoreText: Phaser.GameObjects.Text;
  private comboText: Phaser.GameObjects.Text;
  private progressText: Phaser.GameObjects.Text;
  private circuitLabel: Phaser.GameObjects.Text;
  private targetZone: Phaser.GameObjects.Image;
  private countdownText: Phaser.GameObjects.Text;

  constructor() {
    super('WorkoutScene');
  }

  init(): void {
    this.activeCues = [];
    this.spawnedCount = 0;
    this.hitCount = 0;
    this.missCount = 0;
    this.rawScore = 0;
    this.maxPossibleScore = 0;
    this.isCountingDown = true;
    this.isComplete = false;
  }

  create(): void {
    const { width, height } = this.scale;

    // Determine circuit type
    const today = new Date();
    this.isFridayCircuit = today.getDay() === 5; // 0=Sun, 5=Fri

    // Configure based on circuit type
    this.totalCues = this.isFridayCircuit ? CUE_COUNT_FRIDAY : CUE_COUNT_STANDARD;

    // Day-seeded speed variation (±20%)
    const daySeed = today.getFullYear() * 1000 + today.getMonth() * 31 + today.getDate();
    const speedVariation = 0.8 + (((daySeed * 7 + 13) % 40) / 100); // 0.80 → 1.19
    this.dropSpeed = BASE_DROP_SPEED * speedVariation;

    if (this.isFridayCircuit) {
      this.dropSpeed *= FRIDAY_SPEED_MULTIPLIER;
    }

    // Max possible score
    this.maxPossibleScore = this.totalCues * HIT_SCORES.perfect;

    // Lanes
    if (this.isFridayCircuit) {
      this.lanes = [width * 0.33, width * 0.66]; // Dual lane
    } else {
      this.lanes = [width * 0.5]; // Single lane
    }

    this.targetZoneY = height * TARGET_ZONE_Y_RATIO;

    // ---- Background ----
    this.cameras.main.setBackgroundColor(0x0a0a0f);

    // Subtle grid lines
    const gridGfx = this.add.graphics();
    gridGfx.lineStyle(1, 0x4a7cff, 0.04);
    for (let x = 0; x < width; x += 60) {
      gridGfx.lineBetween(x, 0, x, height);
    }
    for (let y = 0; y < height; y += 60) {
      gridGfx.lineBetween(0, y, width, y);
    }

    // Lane indicators (for Friday dual-lane)
    if (this.isFridayCircuit) {
      const laneGfx = this.add.graphics();
      laneGfx.lineStyle(1, 0x4a7cff, 0.1);
      laneGfx.lineBetween(width * 0.5, 0, width * 0.5, height);

      // Lane labels
      this.add.text(width * 0.33, 30, 'L', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '14px',
        color: '#4a7cff',
      }).setOrigin(0.5).setAlpha(0.3);

      this.add.text(width * 0.66, 30, 'R', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '14px',
        color: '#4a7cff',
      }).setOrigin(0.5).setAlpha(0.3);
    }

    // ---- Target Zone ----
    this.targetZone = this.add
      .image(width / 2, this.targetZoneY, 'target_zone')
      .setDisplaySize(width, 60)
      .setAlpha(0.8);

    // Target zone pulsing
    this.tweens.add({
      targets: this.targetZone,
      alpha: { from: 0.5, to: 0.9 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // ---- Cues managed via activeCues array ----

    // ---- UI: Score ----
    this.scoreText = this.add
      .text(16, 16, 'Score: 0', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '18px',
        color: '#ffd54f',
        fontStyle: 'bold',
      })
      .setDepth(10);

    // ---- UI: Combo / Rating ----
    this.comboText = this.add
      .text(width / 2, this.targetZoneY - 50, '', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '22px',
        color: '#66bb6a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(10)
      .setAlpha(0);

    // ---- UI: Progress ----
    this.progressText = this.add
      .text(width - 16, 16, `0 / ${this.totalCues}`, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '14px',
        color: '#8a8ea8',
      })
      .setOrigin(1, 0)
      .setDepth(10);

    // ---- UI: Circuit Label ----
    if (this.isFridayCircuit) {
      this.circuitLabel = this.add
        .text(width / 2, 50, '⚡ MODIFIED FRIDAY CIRCUIT ⚡', {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '16px',
          color: '#ef5350',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(10);

      // Pulsing red glow
      this.tweens.add({
        targets: this.circuitLabel,
        alpha: { from: 0.7, to: 1 },
        duration: 600,
        yoyo: true,
        repeat: -1,
      });
    }

    // ---- Input: Tap anywhere to score ----
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isCountingDown || this.isComplete) return;
      this.handleTap(pointer.x, pointer.y);
    });

    // ---- Countdown ----
    this.startCountdown();

    // ---- Responsive ----
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.handleResize(gameSize.width, gameSize.height);
    });
  }

  // ---- Countdown ----

  private startCountdown(): void {
    this.isCountingDown = true;
    const { width, height } = this.scale;

    this.countdownText = this.add
      .text(width / 2, height * 0.45, '3', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '72px',
        color: '#4a7cff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(20);

    const countSequence = ['3', '2', '1', 'LIFT!'] as const;
    let idx = 0;

    this.time.addEvent({
      delay: 800,
      repeat: 3,
      callback: () => {
        idx++;
        if (idx < countSequence.length) {
          const text = countSequence[idx];
          if (text !== undefined) {
            this.countdownText.setText(text);
            if (text === 'LIFT!') {
              this.countdownText.setColor('#ffd54f');
              this.countdownText.setFontSize(48);
            }
          }

          // Pop animation
          this.tweens.add({
            targets: this.countdownText,
            scaleX: { from: 1.3, to: 1 },
            scaleY: { from: 1.3, to: 1 },
            duration: 200,
            ease: 'Back.easeOut',
          });
        }

        if (idx === countSequence.length - 1) {
          // Fade out and start
          this.time.delayedCall(500, () => {
            this.tweens.add({
              targets: this.countdownText,
              alpha: 0,
              duration: 200,
              onComplete: () => {
                this.countdownText.destroy();
                this.isCountingDown = false;
                this.startSpawning();
              },
            });
          });
        }
      },
    });
  }

  // ---- Spawning ----

  private startSpawning(): void {
    const interval = this.isFridayCircuit ? 600 : 900; // ms between spawns

    this.time.addEvent({
      delay: interval,
      repeat: this.totalCues - 1,
      callback: () => {
        this.spawnCue();
      },
    });
  }

  private spawnCue(): void {
    if (this.spawnedCount >= this.totalCues) return;

    const laneIdx = this.isFridayCircuit
      ? Math.floor(Math.random() * this.lanes.length)
      : 0;
    const x = this.lanes[laneIdx] ?? this.scale.width / 2;

    const textureKey = this.isFridayCircuit ? 'plate' : 'dumbbell';
    const cue = this.add.image(x, -30, textureKey) as CueSprite;
    cue.lane = laneIdx;
    cue.scored = false;
    cue.setDepth(5);

    // Slight horizontal wobble for visual variety
    const wobble = (Math.random() - 0.5) * 30;
    cue.x += wobble;

    this.activeCues.push(cue);
    this.spawnedCount++;
    this.progressText.setText(`${this.spawnedCount} / ${this.totalCues}`);
  }

  // ---- Update Loop ----

  override update(_time: number, delta: number): void {
    if (this.isCountingDown || this.isComplete) return;

    const { height } = this.scale;
    const dt = delta / 1000; // Convert ms → seconds

    // Move cues downward
    for (let i = this.activeCues.length - 1; i >= 0; i--) {
      const cue = this.activeCues[i];
      if (!cue) continue;

      cue.y += this.dropSpeed * dt;

      // Missed: fell past target zone
      if (cue.y > this.targetZoneY + 80 && !cue.scored) {
        cue.scored = true;
        this.onMiss(cue);
      }

      // Off screen: remove
      if (cue.y > height + 50) {
        this.activeCues.splice(i, 1);
        cue.destroy();
      }
    }

    // Check if all cues have been processed
    if (this.spawnedCount >= this.totalCues && this.activeCues.length === 0) {
      this.completeWorkout();
    }
  }

  // ---- Tap Handling ----

  private handleTap(pointerX: number, _pointerY: number): void {
    // Find the closest unscored cue to the target zone
    let bestCue: CueSprite | null = null;
    let bestDist = Infinity;

    for (const cue of this.activeCues) {
      if (cue.scored) continue;

      const distY = Math.abs(cue.y - this.targetZoneY);

      // For dual-lane, check if tap is on the correct side
      if (this.isFridayCircuit) {
        const screenMid = this.scale.width / 2;
        const tapIsLeft = pointerX < screenMid;
        const cueIsLeft = cue.lane === 0;
        if (tapIsLeft !== cueIsLeft) continue; // Wrong lane
      }

      if (distY < bestDist && distY < 100) {
        bestDist = distY;
        bestCue = cue;
      }
    }

    if (!bestCue) return; // No cue in range

    bestCue.scored = true;
    const distToCenter = Math.abs(bestCue.y - this.targetZoneY);
    const rating = this.getRating(distToCenter);
    const points = HIT_SCORES[rating];

    this.rawScore += points;
    if (rating !== 'miss') {
      this.hitCount++;
    }

    this.updateScoreUI();
    this.showRatingFeedback(rating, bestCue.x);
    this.playCueHitEffect(bestCue, rating);
  }

  private getRating(distance: number): HitRating {
    if (distance <= HIT_THRESHOLDS.perfect) return 'perfect';
    if (distance <= HIT_THRESHOLDS.good) return 'good';
    if (distance <= HIT_THRESHOLDS.ok) return 'ok';
    return 'miss';
  }

  // ---- Miss Handling ----

  private onMiss(cue: CueSprite): void {
    this.missCount++;

    // Friday penalty
    if (this.isFridayCircuit) {
      this.rawScore = Math.max(0, this.rawScore - MISS_PENALTY_FRIDAY);
    }

    this.updateScoreUI();
    this.showRatingFeedback('miss', cue.x);

    // Miss flash effect
    this.tweens.add({
      targets: cue,
      alpha: 0,
      scaleX: 0.3,
      scaleY: 0.3,
      duration: 200,
      ease: 'Power2',
    });
  }

  // ---- Visual Feedback ----

  private showRatingFeedback(rating: HitRating, x: number): void {
    const colorMap: Record<HitRating, string> = {
      perfect: '#ffd54f',
      good: '#66bb6a',
      ok: '#8a8ea8',
      miss: '#ef5350',
    };

    const labelMap: Record<HitRating, string> = {
      perfect: '✨ PERFECT',
      good: '👍 GOOD',
      ok: 'OK',
      miss: '❌ MISS',
    };

    this.comboText.setText(labelMap[rating]);
    this.comboText.setColor(colorMap[rating]);
    this.comboText.setPosition(x, this.targetZoneY - 50);
    this.comboText.setAlpha(1);
    this.comboText.setScale(1);

    this.tweens.add({
      targets: this.comboText,
      alpha: 0,
      y: this.targetZoneY - 80,
      scaleX: 0.8,
      scaleY: 0.8,
      duration: 600,
      ease: 'Power2',
    });
  }

  private playCueHitEffect(cue: CueSprite, rating: HitRating): void {
    const particleKey = rating === 'miss' ? 'particle_miss' : 'particle_hit';

    // Burst particles
    const emitter = this.add.particles(cue.x, cue.y, particleKey, {
      speed: { min: 50, max: 150 },
      scale: { start: 0.8, end: 0 },
      lifespan: 400,
      quantity: rating === 'perfect' ? 12 : 6,
      emitting: false,
    });
    emitter.explode();

    // Destroy after particles finish
    this.time.delayedCall(500, () => {
      emitter.destroy();
    });

    // Scale + fade cue
    this.tweens.add({
      targets: cue,
      alpha: 0,
      scaleX: rating === 'perfect' ? 1.5 : 1.2,
      scaleY: rating === 'perfect' ? 1.5 : 1.2,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        const idx = this.activeCues.indexOf(cue);
        if (idx !== -1) this.activeCues.splice(idx, 1);
        cue.destroy();
      },
    });
  }

  // ---- Score UI ----

  private updateScoreUI(): void {
    this.scoreText.setText(`Score: ${this.rawScore}`);
  }

  // ---- Workout Complete ----

  private completeWorkout(): void {
    if (this.isComplete) return;
    this.isComplete = true;

    // Calculate accuracy percentage
    const accuracy = this.maxPossibleScore > 0
      ? Math.round((this.rawScore / this.maxPossibleScore) * 100)
      : 0;

    const clampedAccuracy = Math.max(0, Math.min(100, accuracy));

    // Pass data to Results scene
    this.scene.start('ResultsScene', {
      accuracy: clampedAccuracy,
      rawScore: this.rawScore,
      maxScore: this.maxPossibleScore,
      hits: this.hitCount,
      misses: this.missCount,
      totalCues: this.totalCues,
      circuitType: this.isFridayCircuit ? 'friday_modified' : 'standard',
    });
  }

  // ---- Resize ----

  private handleResize(width: number, height: number): void {
    this.cameras.resize(width, height);
    this.targetZoneY = height * TARGET_ZONE_Y_RATIO;

    if (this.targetZone) {
      this.targetZone.setPosition(width / 2, this.targetZoneY);
      this.targetZone.setDisplaySize(width, 60);
    }

    // Update lanes
    if (this.isFridayCircuit) {
      this.lanes = [width * 0.33, width * 0.66];
    } else {
      this.lanes = [width * 0.5];
    }

    if (this.scoreText) this.scoreText.setPosition(16, 16);
    if (this.progressText) this.progressText.setPosition(width - 16, 16);
  }
}
