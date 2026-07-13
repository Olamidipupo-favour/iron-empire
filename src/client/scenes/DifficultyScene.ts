import { Scene } from 'phaser';
import * as Phaser from 'phaser';

export type DifficultyLevel = 'light' | 'standard' | 'heavy';

export class DifficultyScene extends Scene {
  private tier: string = 'novice';
  private bodyType: string = 'skinny-fat';
  private dailySplit: string = 'Full Body';

  constructor() {
    super('DifficultyScene');
  }

  init(data: { tier?: string, bodyType?: string, dailySplit?: string }): void {
    this.tier = data.tier ?? 'novice';
    this.bodyType = data.bodyType ?? 'skinny-fat';
    this.dailySplit = data.dailySplit ?? 'Full Body';
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(0x0a0a0f);

    // Title
    this.add.text(width / 2, height * 0.25, 'SELECT WEIGHT', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '22px',
      color: '#4a7cff',
      fontStyle: 'normal',
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.32, 'Choose your difficulty for this session', {
      fontFamily: '"VT323", monospace',
      fontSize: '20px',
      color: '#8a8ea8',
    }).setOrigin(0.5);

    // Buttons configuration
    const options = [
      { label: 'Light Weight (Easy)', value: 'light', color: '#27ae60' },
      { label: 'Standard (Medium)', value: 'standard', color: '#f39c12' },
      { label: 'Heavy Weight (Hard)', value: 'heavy', color: '#c0392b' },
    ] as const;

    const startY = height * 0.45;
    const spacing = 70;

    options.forEach((opt, idx) => {
      const y = startY + (idx * spacing);
      
      const btnBg = this.add.rectangle(width / 2, y, 260, 50, Phaser.Display.Color.HexStringToColor(opt.color).color, 0.2)
        .setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(opt.color).color, 1)
        .setInteractive({ useHandCursor: true });

      const btnText = this.add.text(width / 2, y, opt.label, {
        fontFamily: '"VT323", monospace',
        fontSize: '24px',
        color: opt.color,
        fontStyle: 'normal',
      }).setOrigin(0.5);

      btnBg.on('pointerover', () => {
        btnBg.setFillStyle(Phaser.Display.Color.HexStringToColor(opt.color).color, 0.4);
        btnBg.setScale(1.05);
        btnText.setScale(1.05);
      });

      btnBg.on('pointerout', () => {
        btnBg.setFillStyle(Phaser.Display.Color.HexStringToColor(opt.color).color, 0.2);
        btnBg.setScale(1);
        btnText.setScale(1);
      });

      btnBg.on('pointerdown', () => {
        this.selectDifficulty(opt.value);
      });
    });
  }

  private selectDifficulty(difficulty: DifficultyLevel): void {
    // Fade out and transition
    this.cameras.main.fadeOut(300, 10, 10, 15);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('WorkoutScene', { tier: this.tier, difficulty, bodyType: this.bodyType, dailySplit: this.dailySplit });
    });
  }
}
