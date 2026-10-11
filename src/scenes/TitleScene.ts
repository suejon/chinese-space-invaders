import Phaser from 'phaser';
import { levelName, loadIndex, loadLevel } from '../data';
import { CJK_FONT } from '../theme';

/** Placeholder title screen: proves the word data and CJK font load. The game loop comes next. */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super('title');
  }

  async create() {
    const { width } = this.scale;
    this.add.text(width / 2, 160, 'HSK Invaders', { fontFamily: CJK_FONT, fontSize: '64px', color: '#7cf7ff' }).setOrigin(0.5);
    this.add.text(width / 2, 240, '汉语水平考试 · 太空侵略者', { fontFamily: CJK_FONT, fontSize: '32px', color: '#ffffff' }).setOrigin(0.5);

    const levels = await loadIndex();
    levels.forEach((info, i) => {
      this.add
        .text(width / 2, 360 + i * 56, `${levelName(info.level)}  ·  ${info.count} words`, {
          fontFamily: CJK_FONT,
          fontSize: '30px',
          color: '#c8d0ff',
        })
        .setOrigin(0.5);
    });

    const sample = (await loadLevel(1)).slice(0, 6);
    sample.forEach((word, i) => {
      this.add
        .text(width / 2, 820 + i * 64, `${word.hanzi}  ${word.pinyin}  ${word.gloss}`, {
          fontFamily: CJK_FONT,
          fontSize: '30px',
          color: '#ffe27a',
        })
        .setOrigin(0.5);
    });
  }
}
