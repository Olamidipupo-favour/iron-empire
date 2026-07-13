import { Scene } from 'phaser';
import type { InitResponse } from '../../shared/api';

/**
 * Preloader: Generates all game textures programmatically.
 * No external asset files are needed.
 */
export class Preloader extends Scene {
  constructor() {
    super('Preloader');
  }

  preload() {
    this.load.image('avatar_novice', 'assets/avatar_novice.png');
    this.load.image('avatar_athlete', 'assets/avatar_athlete.png');
    this.load.image('avatar_vtaper', 'assets/avatar_vtaper.png');
  }

  create() {
    const { width, height } = this.scale;

    // ---- Background ----
    this.cameras.main.setBackgroundColor(0x0a0a0f);

    // Title
    this.add
      .text(width / 2, height * 0.35, 'IRON EMPIRE', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '24px',
        color: '#4a7cff',
        fontStyle: 'normal',
      })
      .setOrigin(0.5);

    // Subtitle
    this.add
      .text(width / 2, height * 0.42, 'Chalking up…', {
        fontFamily: '"VT323", monospace',
        fontSize: '20px',
        color: '#8a8ea8',
      })
      .setOrigin(0.5);

    // Progress bar outline
    const barWidth = Math.min(width * 0.6, 300);
    const barX = (width - barWidth) / 2;
    const barY = height * 0.52;

    this.add.rectangle(width / 2, barY, barWidth, 12).setStrokeStyle(1, 0xffffff);

    const fill = this.add.rectangle(barX + 2, barY, 4, 8, 0x4a7cff).setOrigin(0, 0.5);

    // ---- Generate Textures ----

    // Dumbbell texture (standard cue)
    this.generateDumbbellTexture('dumbbell', 0x4a7cff);

    // Plate texture (Friday circuit cue)
    this.generatePlateTexture('plate', 0xffd54f);

    // Target zone glow
    this.generateTargetZoneTexture('target_zone', width);

    // Hit particle
    this.generateParticleTexture('particle_hit', 0x66bb6a);

    // Miss particle
    this.generateParticleTexture('particle_miss', 0xef5350);

    // Simulate loading progress
    let progress = 0;
    this.time.addEvent({
      delay: 20,
      repeat: 49,
      callback: () => {
        progress += 0.02;
        fill.width = 4 + (barWidth - 8) * progress;
      },
    });

    // Fetch user tier to pass to WorkoutScene
    let tier = 'novice';
    fetch('/api/init')
      .then(res => res.json())
      .then((data: InitResponse) => {
        if (data.user.physiqueTier === 'V-Taper') tier = 'vtaper';
        else if (data.user.physiqueTier === 'Athlete') tier = 'athlete';
      })
      .catch(e => console.error('Failed to load tier in Preloader', e));

    // After "loading" completes, start difficulty selection
    this.time.delayedCall(1200, () => {
      this.scene.start('DifficultyScene', { tier });
    });
  }

  private generateDumbbellTexture(key: string, color: number): void {
    const gfx = this.add.graphics();
    const w = 48;
    const h = 48;

    // Bar
    gfx.fillStyle(color, 1);
    gfx.fillRoundedRect(6, 20, 36, 8, 3);

    // Left weight
    gfx.fillStyle(color, 0.9);
    gfx.fillRoundedRect(2, 12, 12, 24, 4);

    // Right weight
    gfx.fillRoundedRect(34, 12, 12, 24, 4);

    // Highlight
    gfx.fillStyle(0xffffff, 0.2);
    gfx.fillRoundedRect(4, 13, 8, 6, 2);
    gfx.fillRoundedRect(36, 13, 8, 6, 2);

    gfx.generateTexture(key, w, h);
    gfx.destroy();
  }

  private generatePlateTexture(key: string, color: number): void {
    const gfx = this.add.graphics();
    const size = 48;

    // Outer circle
    gfx.fillStyle(color, 0.9);
    gfx.fillCircle(size / 2, size / 2, 20);

    // Inner ring
    gfx.fillStyle(0x0a0a0f, 1);
    gfx.fillCircle(size / 2, size / 2, 10);

    // Center dot
    gfx.fillStyle(color, 1);
    gfx.fillCircle(size / 2, size / 2, 4);

    // Highlight
    gfx.fillStyle(0xffffff, 0.15);
    gfx.fillCircle(18, 18, 6);

    gfx.generateTexture(key, size, size);
    gfx.destroy();
  }

  private generateTargetZoneTexture(key: string, sceneWidth: number): void {
    const gfx = this.add.graphics();
    const w = Math.max(sceneWidth, 400);
    const h = 60;

    // Glow area
    gfx.fillStyle(0x4a7cff, 0.08);
    gfx.fillRect(0, 0, w, h);

    // Center line
    gfx.lineStyle(2, 0x4a7cff, 0.6);
    gfx.lineBetween(0, h / 2, w, h / 2);

    // Edge lines
    gfx.lineStyle(1, 0x4a7cff, 0.2);
    gfx.lineBetween(0, 8, w, 8);
    gfx.lineBetween(0, h - 8, w, h - 8);

    gfx.generateTexture(key, w, h);
    gfx.destroy();
  }

  private generateParticleTexture(key: string, color: number): void {
    const gfx = this.add.graphics();
    gfx.fillStyle(color, 1);
    gfx.fillCircle(8, 8, 6);
    gfx.fillStyle(0xffffff, 0.3);
    gfx.fillCircle(6, 6, 2);
    gfx.generateTexture(key, 16, 16);
    gfx.destroy();
  }
}
