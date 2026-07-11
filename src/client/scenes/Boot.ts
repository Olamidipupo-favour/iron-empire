import { Scene } from 'phaser';

export class Boot extends Scene {
  constructor() {
    super('Boot');
  }

  create() {
    // No external assets needed — all graphics are generated programmatically.
    this.scene.start('Preloader');
  }
}
