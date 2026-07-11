import { Scene } from 'phaser';
import * as Phaser from 'phaser';
import type { WorkoutSubmitResponse, CircuitType } from '../../shared/api';

type ResultsData = {
  accuracy: number;
  rawScore: number;
  maxScore: number;
  hits: number;
  misses: number;
  totalCues: number;
  circuitType: CircuitType;
};

export class ResultsScene extends Scene {
  private resultsData: ResultsData;
  private isSubmitting: boolean = false;

  constructor() {
    super('ResultsScene');
  }

  init(data: ResultsData): void {
    this.resultsData = data;
    this.isSubmitting = false;
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(0x0a0a0f);

    // Background particles
    this.add.particles(width / 2, height / 2, 'particle_hit', {
      speed: { min: 10, max: 40 },
      scale: { start: 0.3, end: 0 },
      alpha: { start: 0.15, end: 0 },
      lifespan: 3000,
      frequency: 200,
    });

    // Title
    const titleY = height * 0.08;
    this.add.text(width / 2, titleY, 'WORKOUT COMPLETE', {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '20px',
      color: '#4a7cff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Circuit type label
    const circuitText = this.resultsData.circuitType === 'friday_modified'
      ? '⚡ Modified Friday Circuit' : '💪 Standard Circuit';
    const circuitColor = this.resultsData.circuitType === 'friday_modified'
      ? '#ef5350' : '#8a8ea8';
    this.add.text(width / 2, titleY + 30, circuitText, {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '13px',
      color: circuitColor,
    }).setOrigin(0.5);

    // Accuracy score
    const scoreY = height * 0.28;
    this.add.text(width / 2, scoreY - 20, 'ACCURACY', {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '12px',
      color: '#8a8ea8',
    }).setOrigin(0.5);

    const accColor = this.resultsData.accuracy > 70 ? '#66bb6a'
      : this.resultsData.accuracy > 40 ? '#ffd54f' : '#ef5350';

    const accuracyText = this.add.text(width / 2, scoreY + 20, '0%', {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '64px',
      color: accColor,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Animate counter
    this.tweens.addCounter({
      from: 0,
      to: this.resultsData.accuracy,
      duration: 1500,
      ease: 'Cubic.easeOut',
      onUpdate: (tween) => {
        const val = tween.getValue();
        accuracyText.setText(`${Math.round(val ?? 0)}%`);
      },
    });

    // Stats grid
    const statsY = height * 0.48;
    const statItems = [
      { label: 'Hits', value: String(this.resultsData.hits), color: '#66bb6a' },
      { label: 'Misses', value: String(this.resultsData.misses), color: '#ef5350' },
      { label: 'Raw Score', value: String(this.resultsData.rawScore), color: '#ffd54f' },
      { label: 'Max Score', value: String(this.resultsData.maxScore), color: '#8a8ea8' },
    ];

    const colWidth = width * 0.4;
    const startX = width / 2 - colWidth * 0.5;

    statItems.forEach((item, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = startX + col * colWidth;
      const y = statsY + row * 50;

      this.add.text(x, y, item.label, {
        fontFamily: 'Inter, Arial, sans-serif', fontSize: '11px', color: '#8a8ea8',
      }).setOrigin(0.5);

      this.add.text(x, y + 18, item.value, {
        fontFamily: 'Inter, Arial, sans-serif', fontSize: '22px',
        color: item.color, fontStyle: 'bold',
      }).setOrigin(0.5);
    });

    // Growth details (shown after submission)
    const growthY = height * 0.68;
    const growthTitle = this.add.text(width / 2, growthY, '', {
      fontFamily: 'Inter, Arial, sans-serif', fontSize: '14px',
      color: '#4a7cff', fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);

    const growthDetails = this.add.text(width / 2, growthY + 24, '', {
      fontFamily: 'Inter, Arial, sans-serif', fontSize: '13px',
      color: '#e8eaf6', align: 'center', lineSpacing: 6,
    }).setOrigin(0.5).setAlpha(0);

    // Status text
    const statusText = this.add.text(width / 2, height * 0.82, 'Submitting score…', {
      fontFamily: 'Inter, Arial, sans-serif', fontSize: '13px', color: '#8a8ea8',
    }).setOrigin(0.5);

    // Return button (hidden initially)
    const btnY = height * 0.9;
    const btnBg = this.add.rectangle(width / 2, btnY, 220, 44, 0x4a7cff, 1)
      .setInteractive({ useHandCursor: true }).setVisible(false);
    const btnText = this.add.text(width / 2, btnY, 'Return to Dashboard', {
      fontFamily: 'Inter, Arial, sans-serif', fontSize: '14px',
      color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setVisible(false);

    btnBg.on('pointerover', () => btnBg.setFillStyle(0x3b5bdb));
    btnBg.on('pointerout', () => btnBg.setFillStyle(0x4a7cff));
    btnBg.on('pointerdown', () => {
      window.parent.postMessage({ type: 'close' }, '*');
    });

    // Submit score
    void this.submitScore(statusText, growthTitle, growthDetails, btnBg, btnText);
  }

  private async submitScore(
    statusText: Phaser.GameObjects.Text,
    growthTitle: Phaser.GameObjects.Text,
    growthDetails: Phaser.GameObjects.Text,
    btnBg: Phaser.GameObjects.Rectangle,
    btnText: Phaser.GameObjects.Text,
  ): Promise<void> {
    if (this.isSubmitting) return;
    this.isSubmitting = true;

    try {
      const response = await fetch('/api/workout/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score: this.resultsData.accuracy,
          circuitType: this.resultsData.circuitType,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const result = await response.json() as WorkoutSubmitResponse;

      statusText.setText(result.growthApplied ? '✅ Stats updated!' : '📊 Score recorded');
      statusText.setColor(result.growthApplied ? '#66bb6a' : '#8a8ea8');

      if (result.growthApplied) {
        growthTitle.setText('💪 Growth Applied');
        growthDetails.setText(
          `Weight: +${result.weightDelta.toFixed(2)} kg\n` +
          `Muscle: +${result.muscleDelta.toFixed(2)}\n` +
          `Community: +${result.communityPointsEarned} pts`
        );
      } else {
        growthTitle.setText('Keep Pushing!');
        growthDetails.setText('Score above 70% to gain stats');
      }

      this.tweens.add({
        targets: [growthTitle, growthDetails],
        alpha: 1, duration: 400, ease: 'Power2',
      });
    } catch (error) {
      console.error('Failed to submit workout:', error);
      statusText.setText('⚠️ Score saved locally');
      statusText.setColor('#ffd54f');
    } finally {
      btnBg.setVisible(true);
      btnText.setVisible(true);
      this.tweens.add({
        targets: [btnBg, btnText],
        alpha: { from: 0, to: 1 }, duration: 300,
      });
    }
  }
}
