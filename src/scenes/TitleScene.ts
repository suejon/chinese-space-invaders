import Phaser from 'phaser';
import { levelName, loadIndex } from '../data';
import { COLORS, textStyle } from '../theme';

/** Level select. Tap a level, or press 1–7. */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super('title');
  }

  async create() {
    const { width } = this.scale;
    this.add.text(width / 2, 170, 'HSK Invaders', textStyle(68, COLORS.title)).setOrigin(0.5);
    this.add.text(width / 2, 250, '汉字 · 太空侵略者', textStyle(34)).setOrigin(0.5);
    this.add
      .text(width / 2, 330, 'Shoot the ship whose word matches the meaning.', textStyle(24, COLORS.muted))
      .setOrigin(0.5);

    const levels = await loadIndex();
    const start = (level: number) => this.scene.start('game', { level });

    levels.forEach((info, i) => {
      const y = 450 + i * 92;
      const button = this.add
        .rectangle(width / 2, y, 440, 72, COLORS.enemy)
        .setStrokeStyle(2, COLORS.enemyEdge)
        .setInteractive({ useHandCursor: true });
      this.add.text(width / 2 - 190, y, levelName(info.level), textStyle(32, COLORS.accent)).setOrigin(0, 0.5);
      this.add.text(width / 2 + 190, y, `${info.count} words`, textStyle(24, COLORS.muted)).setOrigin(1, 0.5);
      button.on('pointerover', () => button.setFillStyle(0x3a4290));
      button.on('pointerout', () => button.setFillStyle(COLORS.enemy));
      button.on('pointerdown', () => start(info.level));
    });

    this.add
      .text(width / 2, 450 + levels.length * 92 + 30, 'Press 1–7 or tap a level to start', textStyle(22, COLORS.muted))
      .setOrigin(0.5);

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      const level = Number(event.key);
      if (levels.some((l) => l.level === level)) start(level);
    });
  }
}
