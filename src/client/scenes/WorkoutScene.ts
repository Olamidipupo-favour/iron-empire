import { Scene } from 'phaser';
import * as Phaser from 'phaser';
import type { DifficultyLevel } from './DifficultyScene';

// ---- Types ----

type HitRating = 'perfect' | 'good' | 'ok' | 'miss';

// ---- Constants ----

const REPS_STANDARD = 30;
const REPS_FRIDAY = 45;
const FRIDAY_SPEED_MULTIPLIER = 1.3;
const MISS_PENALTY_FRIDAY = 3;

const HIT_THRESHOLDS = {
  perfect: 20, // distance from center of meter
  good: 45,
  ok: 80,
} as const;

const HIT_SCORES = {
  perfect: 10,
  good: 7,
  ok: 4,
  miss: 0,
} as const;

/**
 * WorkoutScene: The rhythm/timing-based lifting minigame.
 *
 * Replaces falling cues with a visual Avatar and Barbell.
 * A swinging Power Meter at the bottom dictates accuracy.
 * Tapping stops the meter, animates the lift, and resumes.
 */
export class WorkoutScene extends Scene {
  // Config
  private tier: string = 'novice';
  private isFridayCircuit: boolean = false;
  private totalReps: number = REPS_STANDARD;
  private maxPossibleScore: number = 0;
  private needleSpeed: number = 600; // ms per half-swing
  private difficulty: DifficultyLevel = 'standard';

  // State
  private currentRep: number = 0;
  private hitCount: number = 0;
  private missCount: number = 0;
  private rawScore: number = 0;
  private isCountingDown: boolean = true;
  private isAnimatingRep: boolean = false;
  private isComplete: boolean = false;

  // Game Objects
  private avatarImage!: Phaser.GameObjects.Image;
  private barbellContainer!: Phaser.GameObjects.Container;
  private needle!: Phaser.GameObjects.Rectangle;
  private needleTween!: Phaser.Tweens.Tween;

  // UI Elements
  private scoreText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private feedbackText!: Phaser.GameObjects.Text;
  private countdownText!: Phaser.GameObjects.Text;

  // Layout params
  private meterX: number = 0;
  private meterY: number = 0;
  private meterWidth: number = 0;

  constructor() {
    super('WorkoutScene');
  }

  init(data: { tier?: string, difficulty?: DifficultyLevel }): void {
    this.tier = data.tier ?? 'novice';
    this.difficulty = data.difficulty ?? 'standard';
    this.currentRep = 0;
    this.hitCount = 0;
    this.missCount = 0;
    this.rawScore = 0;
    this.isCountingDown = true;
    this.isAnimatingRep = false;
    this.isComplete = false;
  }

  create(): void {
    const { width, height } = this.scale;

    // Determine circuit type
    const today = new Date();
    this.isFridayCircuit = today.getDay() === 5; // 0=Sun, 5=Fri

    // Configure based on circuit type
    this.totalReps = this.isFridayCircuit ? REPS_FRIDAY : REPS_STANDARD;
    this.maxPossibleScore = this.totalReps * HIT_SCORES.perfect;

    const daySeed = today.getFullYear() * 1000 + today.getMonth() * 31 + today.getDate();
    const speedVariation = 0.8 + (((daySeed * 7 + 13) % 40) / 100);
    
    // Slow down the overall speed (base changed from 700 to 1100)
    // Beginner gains: Novices get a slower meter (easier). 
    let tierModifier = 1.0;
    if (this.tier === 'novice') tierModifier = 1.4;
    else if (this.tier === 'athlete') tierModifier = 1.2;
    
    let difficultyModifier = 1.0;
    if (this.difficulty === 'light') difficultyModifier = 1.2;
    else if (this.difficulty === 'heavy') difficultyModifier = 0.8;
    
    this.needleSpeed = 1100 * speedVariation * tierModifier * difficultyModifier; // Base swing speed

    if (this.isFridayCircuit) {
      this.needleSpeed /= FRIDAY_SPEED_MULTIPLIER; // Faster swing
    }

    // ---- Background & Env ----
    this.cameras.main.setBackgroundColor(0x0d0d0d);

    // Grunge texture background (simulated via dots)
    const dotGfx = this.add.graphics();
    dotGfx.fillStyle(0xffffff, 0.02);
    for (let i = 0; i < 200; i++) {
      dotGfx.fillCircle(Math.random() * width, Math.random() * height, Math.random() * 2);
    }

    // Circuit Label
    if (this.isFridayCircuit) {
      this.add.text(width / 2, 40, '🔥 HEAVY SQUAT DAY 🔥', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '14px',
        color: '#ef5350',
        fontStyle: 'normal',
      }).setOrigin(0.5).setAlpha(0.8);
    }

    // ---- Visual Character ----
    const avatarY = height / 2 - 40;
    this.avatarImage = this.add.image(width / 2, avatarY, `avatar_${this.tier}`);
    this.avatarImage.setScale(1.2); // Make lifter prominent

    // Pulse aura behind avatar
    const auraColor = this.tier === 'vtaper' ? 0xf39c12 : this.tier === 'athlete' ? 0x7f8c8d : 0xc4a265;
    const aura = this.add.circle(width / 2, avatarY + 20, 100, auraColor, 0.1);
    this.tweens.add({
      targets: aura,
      scale: 1.2,
      alpha: 0.05,
      duration: 1500,
      yoyo: true,
      repeat: -1,
    });

    // Bring avatar to front above aura
    this.avatarImage.setDepth(2);

    // ---- Barbell ----
    this.barbellContainer = this.add.container(width / 2, avatarY + 50);
    this.barbellContainer.setDepth(3);

    // Draw barbell graphics
    const barGfx = this.add.graphics();
    // The bar itself
    barGfx.fillStyle(0x7f8c8d, 1);
    barGfx.fillRect(-120, -4, 240, 8);
    
    // The plates
    const plateColor = this.isFridayCircuit ? 0xc0392b : 0x333333;
    // Left plate
    barGfx.fillStyle(plateColor, 1);
    barGfx.fillRoundedRect(-100, -25, 20, 50, 4);
    barGfx.fillStyle(0x111111, 1);
    barGfx.fillRoundedRect(-95, -20, 10, 40, 2);
    
    // Right plate
    barGfx.fillStyle(plateColor, 1);
    barGfx.fillRoundedRect(80, -25, 20, 50, 4);
    barGfx.fillStyle(0x111111, 1);
    barGfx.fillRoundedRect(85, -20, 10, 40, 2);

    this.barbellContainer.add(barGfx);

    // ---- Power Meter ----
    this.meterWidth = Math.min(width * 0.8, 320);
    this.meterX = width / 2;
    this.meterY = height - 100;

    const meterBg = this.add.graphics();
    meterBg.setDepth(4);
    
    // Red zones (edges)
    meterBg.fillStyle(0xc0392b, 0.8);
    meterBg.fillRect(this.meterX - this.meterWidth / 2, this.meterY - 10, this.meterWidth, 20);

    // Yellow zones (mid)
    meterBg.fillStyle(0xf39c12, 0.8);
    meterBg.fillRect(this.meterX - HIT_THRESHOLDS.ok, this.meterY - 10, HIT_THRESHOLDS.ok * 2, 20);

    // Green zone (center perfect)
    meterBg.fillStyle(0x27ae60, 0.8);
    meterBg.fillRect(this.meterX - HIT_THRESHOLDS.perfect, this.meterY - 10, HIT_THRESHOLDS.perfect * 2, 20);

    // Center line
    meterBg.fillStyle(0xffffff, 1);
    meterBg.fillRect(this.meterX - 1, this.meterY - 14, 2, 28);

    // Outline
    meterBg.lineStyle(2, 0x333333, 1);
    meterBg.strokeRect(this.meterX - this.meterWidth / 2, this.meterY - 10, this.meterWidth, 20);

    // Needle
    this.needle = this.add.rectangle(this.meterX - this.meterWidth / 2, this.meterY, 6, 32, 0xffffff);
    this.needle.setDepth(5);
    this.needle.setStrokeStyle(1, 0x000000);

    // Setup Needle Tween (Paused initially)
    this.needleTween = this.tweens.add({
      targets: this.needle,
      x: this.meterX + this.meterWidth / 2,
      duration: this.needleSpeed,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      paused: true,
    });

    // ---- UI Text ----
    this.scoreText = this.add.text(16, 16, 'Reps: 0', {
      fontFamily: '"VT323", monospace', fontSize: '24px',
      color: '#e67e22', fontStyle: 'normal',
    }).setDepth(10);

    this.progressText = this.add.text(width - 16, 16, `0 / ${this.totalReps}`, {
      fontFamily: '"VT323", monospace', fontSize: '20px',
      color: '#999999',
    }).setOrigin(1, 0).setDepth(10);

    this.feedbackText = this.add.text(width / 2, this.meterY - 50, '', {
      fontFamily: '"Press Start 2P", monospace', fontSize: '20px',
      color: '#ffffff', fontStyle: 'normal', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(10).setAlpha(0);

    // ---- Input ----
    this.input.on('pointerdown', () => {
      if (this.isCountingDown || this.isComplete || this.isAnimatingRep) return;
      this.handleTap();
    });

    // ---- Countdown ----
    this.startCountdown();
  }

  // ---- Countdown ----

  private startCountdown(): void {
    this.isCountingDown = true;
    const { width, height } = this.scale;

    this.countdownText = this.add.text(width / 2, height * 0.4, '3', {
      fontFamily: '"Press Start 2P", monospace', fontSize: '60px',
      color: '#e67e22', fontStyle: 'normal', stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(20);

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
              this.countdownText.setColor('#f39c12');
              this.countdownText.setFontSize(48);
            }
          }

          this.tweens.add({
            targets: this.countdownText,
            scaleX: { from: 1.4, to: 1 },
            scaleY: { from: 1.4, to: 1 },
            duration: 200,
            ease: 'Back.easeOut',
          });
        }

        if (idx === countSequence.length - 1) {
          this.time.delayedCall(500, () => {
            this.tweens.add({
              targets: this.countdownText,
              alpha: 0, duration: 200,
              onComplete: () => {
                this.countdownText.destroy();
                this.isCountingDown = false;
                this.needleTween.resume();
              },
            });
          });
        }
      },
    });
  }

  // ---- Logic ----

  private handleTap(): void {
    this.isAnimatingRep = true;
    this.needleTween.pause();

    const distFromCenter = Math.abs(this.needle.x - this.meterX);
    const rating = this.getRating(distFromCenter);
    const points = HIT_SCORES[rating];

    this.rawScore += points;
    if (rating !== 'miss') {
      this.hitCount++;
    } else {
      this.missCount++;
      if (this.isFridayCircuit) {
        this.rawScore = Math.max(0, this.rawScore - MISS_PENALTY_FRIDAY);
      }
    }

    this.updateUI();
    this.showFeedback(rating);
    this.animateLifter(rating);
  }

  private getRating(distance: number): HitRating {
    if (distance <= HIT_THRESHOLDS.perfect) return 'perfect';
    if (distance <= HIT_THRESHOLDS.good) return 'good';
    if (distance <= HIT_THRESHOLDS.ok) return 'ok';
    return 'miss';
  }

  private updateUI(): void {
    this.scoreText.setText(`Reps: ${this.rawScore}`);
    this.progressText.setText(`${this.currentRep + 1} / ${this.totalReps}`);
  }

  private showFeedback(rating: HitRating): void {
    const labels: Record<HitRating, string> = {
      perfect: 'CLEAN!',
      good: 'GOOD',
      ok: 'SLOPPY',
      miss: 'FAILED REP',
    };
    const colors: Record<HitRating, string> = {
      perfect: '#f39c12',
      good: '#27ae60',
      ok: '#999999',
      miss: '#c0392b',
    };

    this.feedbackText.setText(labels[rating]);
    this.feedbackText.setColor(colors[rating]);
    this.feedbackText.setAlpha(1);
    this.feedbackText.setScale(0.5);
    this.feedbackText.setY(this.meterY - 40);

    this.tweens.add({
      targets: this.feedbackText,
      y: this.meterY - 80,
      alpha: 0,
      scale: 1.2,
      duration: 600,
      ease: 'Cubic.easeOut',
    });
  }

  private animateLifter(rating: HitRating): void {
    const startY = this.barbellContainer.y;
    const liftY = startY - 70; // Push bar up
    
    if (rating !== 'miss') {
      // Successful lift animation
      
      // Avatar bump to simulate effort
      this.tweens.add({
        targets: this.avatarImage,
        y: this.avatarImage.y + 5,
        duration: 100,
        yoyo: true,
      });

      // Barbell goes up then down
      this.tweens.add({
        targets: this.barbellContainer,
        y: liftY,
        duration: 150,
        ease: 'Sine.easeOut',
        yoyo: true,
        onComplete: () => this.finishRep(),
      });

      // Camera slight shake on perfect
      if (rating === 'perfect') {
        this.cameras.main.shake(100, 0.005);
      }
    } else {
      // Failed lift animation
      this.cameras.main.shake(200, 0.01);
      
      this.tweens.add({
        targets: this.barbellContainer,
        x: this.barbellContainer.x + 10,
        y: this.barbellContainer.y + 10,
        duration: 50,
        yoyo: true,
        repeat: 3,
        onComplete: () => {
          this.barbellContainer.setPosition(this.scale.width / 2, startY);
          this.finishRep();
        },
      });
    }
  }

  private finishRep(): void {
    this.currentRep++;
    if (this.currentRep >= this.totalReps) {
      this.completeWorkout();
    } else {
      // Resume meter with slight speedup for difficulty curve
      // Beginner gains: gentler curve for novices
      let speedup = 1.015;
      if (this.tier === 'novice') speedup = 1.005;
      else if (this.tier === 'athlete') speedup = 1.01;

      this.needleTween.timeScale *= speedup; 
      this.needleTween.resume();
      this.isAnimatingRep = false;
    }
  }

  private completeWorkout(): void {
    this.isComplete = true;

    const accuracy = this.maxPossibleScore > 0
      ? Math.round((this.rawScore / this.maxPossibleScore) * 100)
      : 0;

    this.scene.start('ResultsScene', {
      accuracy: Math.max(0, Math.min(100, accuracy)),
      rawScore: this.rawScore,
      maxScore: this.maxPossibleScore,
      hits: this.hitCount,
      misses: this.missCount,
      totalCues: this.totalReps,
      circuitType: this.isFridayCircuit ? 'friday_modified' : 'standard',
    });
  }
}
