import Phaser from 'phaser';
import { levelName } from '../data';
import type { RunState } from '../game/run';
import { COLORS, textStyle } from '../theme';

const MAX_LISTED = 8;

/** End of run: score, accuracy and the words to review. */
export class ResultsScene extends Phaser.Scene {
  constructor() {
    super('results');
  }

  create(data: { run: RunState }) {
    const { run } = data;
    const { width } = this.scale;

    const heading = run.isWon ? 'Sector cleared!' : run.invaded ? 'Invaded!' : 'Shields down';
    this.add.text(width / 2, 140, heading, textStyle(60, run.isWon ? COLORS.good : COLORS.bad)).setOrigin(0.5);
    this.add.text(width / 2, 210, levelName(run.level), textStyle(28, COLORS.muted)).setOrigin(0.5);

    const stats = [
      ['Score', `${run.score}`],
      ['Accuracy', `${Math.round(run.accuracy * 100)}%`],
      ['Words practiced', `${run.results.size}`],
      ['Waves cleared', `${run.wave}/${run.waveCount}`],
    ];
    stats.forEach(([label, value], i) => {
      const y = 300 + i * 56;
      this.add.text(width / 2 - 220, y, label, textStyle(30, COLORS.muted)).setOrigin(0, 0.5);
      this.add.text(width / 2 + 220, y, value, textStyle(30)).setOrigin(1, 0.5);
    });

    const missed = run.missedWords.slice(0, MAX_LISTED);
    this.add
      .text(width / 2, 560, missed.length > 0 ? 'Review these words' : 'No mistakes. 太棒了!', textStyle(32, COLORS.accent))
      .setOrigin(0.5);
    missed.forEach(({ word }, i) => {
      const y = 630 + i * 62;
      this.add.text(60, y, word.hanzi, textStyle(38)).setOrigin(0, 0.5);
      this.add.text(260, y - 14, word.pinyin, textStyle(24, COLORS.title)).setOrigin(0, 0.5);
      this.add.text(260, y + 16, word.gloss, textStyle(22, COLORS.muted)).setOrigin(0, 0.5);
    });

    const replay = () => this.scene.start('game', { level: run.level });
    const levels = () => this.scene.start('title');
    this.button(width / 2 - 150, 1150, 'Play again', replay);
    this.button(width / 2 + 150, 1150, 'Levels', levels);
    this.add.text(width / 2, 1225, 'Space to play again · Esc for levels', textStyle(20, COLORS.muted)).setOrigin(0.5);

    const keyboard = this.input.keyboard!;
    keyboard.once('keydown-SPACE', replay);
    keyboard.once('keydown-ENTER', replay);
    keyboard.once('keydown-ESC', levels);
  }

  private button(x: number, y: number, label: string, onClick: () => void) {
    const rect = this.add
      .rectangle(x, y, 260, 76, COLORS.enemy)
      .setStrokeStyle(2, COLORS.enemyEdge)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', onClick);
    rect.on('pointerover', () => rect.setFillStyle(0x3a4290));
    rect.on('pointerout', () => rect.setFillStyle(COLORS.enemy));
    this.add.text(x, y, label, textStyle(30)).setOrigin(0.5);
  }
}
