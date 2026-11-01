import Phaser from 'phaser';
import { levelName, loadIndex, loadLevel, type Word } from '../data';
import { MATURE_DAYS, progress } from '../game/progress';
import { accuracyOf, history, levelBreakdown, recentDays, streak, totals, weakestWords } from '../game/stats';
import { COLORS, textStyle } from '../theme';

const CHART_DAYS = 14;
const WEAK_COUNT = 6;
const LEARNING_COLOR = 0x4f6bd8;
const MATURE_COLOR = 0x6dff9c;
const TRACK_COLOR = 0x15183a;

const percent = (value: number | undefined) => (value === undefined ? '–' : `${Math.round(value * 100)}%`);

/** Learning progress: totals, words per HSK level, daily accuracy and the words that need the most work. */
export class StatsScene extends Phaser.Scene {
  constructor() {
    super('stats');
  }

  async create() {
    const { width } = this.scale;
    const records = progress.entries();
    const days = recentDays(history, CHART_DAYS);

    this.add.text(width / 2, 80, 'Your progress', textStyle(52, COLORS.title)).setOrigin(0.5);

    // Headline numbers.
    const sum = totals(records);
    const tiles: [string, string][] = [
      ['words seen', `${sum.seen}`],
      ['mastered', `${sum.mature}`],
      ['accuracy 7d', percent(accuracyOf(days.slice(-7)))],
      ['day streak', `${streak(history)}`],
    ];
    const tileW = (width - 60 - 3 * 12) / 4;
    tiles.forEach(([label, value], i) => {
      const x = 30 + tileW / 2 + i * (tileW + 12);
      this.add.rectangle(x, 190, tileW, 110, TRACK_COLOR).setStrokeStyle(2, COLORS.enemy);
      this.add.text(x, 172, value, textStyle(40, COLORS.accent)).setOrigin(0.5);
      this.add.text(x, 220, label, textStyle(19, COLORS.muted)).setOrigin(0.5);
    });

    // Words per level: mastered, then learning, on a track the length of the level.
    this.add.text(30, 290, 'By level', textStyle(28, COLORS.accent)).setOrigin(0, 0.5);
    this.legend(width - 30, 290);
    const levels = levelBreakdown(records, await loadIndex());
    const barX = 160;
    const barW = width - barX - 30;
    levels.forEach((s, i) => {
      const y = 338 + i * 42;
      this.add.text(30, y, levelName(s.level), textStyle(24)).setOrigin(0, 0.5);
      this.add.rectangle(barX, y, barW, 26, TRACK_COLOR).setOrigin(0, 0.5);
      const matureW = (barW * s.mature) / s.total;
      const learningW = (barW * s.learning) / s.total;
      if (matureW > 0) this.add.rectangle(barX, y, Math.max(matureW, 3), 26, MATURE_COLOR).setOrigin(0, 0.5);
      if (learningW > 0) this.add.rectangle(barX + matureW, y, Math.max(learningW, 3), 26, LEARNING_COLOR).setOrigin(0, 0.5);
      const label = `${s.mature + s.learning}/${s.total}`;
      this.add.text(barX + barW - 8, y, label, textStyle(18, COLORS.text)).setOrigin(1, 0.5).setShadow(0, 0, '#000', 4, false, true);
    });

    this.chart(30, 660, width - 60, days);
    await this.weakWords(30, 920, width - 60);

    const back = () => this.scene.start('title');
    const rect = this.add
      .rectangle(width / 2, 1215, 260, 72, COLORS.enemy)
      .setStrokeStyle(2, COLORS.enemyEdge)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', back);
    rect.on('pointerover', () => rect.setFillStyle(0x3a4290));
    rect.on('pointerout', () => rect.setFillStyle(COLORS.enemy));
    this.add.text(width / 2, 1215, 'Levels', textStyle(30)).setOrigin(0.5);
    this.input.keyboard?.once('keydown-ESC', back);
  }

  private legend(right: number, y: number) {
    const items: [number, string][] = [
      [LEARNING_COLOR, 'learning'],
      [MATURE_COLOR, `mastered (${MATURE_DAYS}d+)`],
    ];
    let x = right;
    for (const [color, label] of [...items].reverse()) {
      const text = this.add.text(x, y, label, textStyle(18, COLORS.muted)).setOrigin(1, 0.5);
      x -= text.width + 8;
      this.add.rectangle(x, y, 14, 14, color).setOrigin(1, 0.5);
      x -= 30;
    }
  }

  /** Answers per day as bars (right in green, wrong in red, stacked), with each day's accuracy above. */
  private chart(x: number, top: number, w: number, days: ReturnType<typeof recentDays>) {
    this.add.text(x, top, `Last ${CHART_DAYS} days`, textStyle(28, COLORS.accent)).setOrigin(0, 0.5);
    const answers = days.reduce((n, d) => n + d.correct + d.wrong, 0);
    const fresh = days.reduce((n, d) => n + d.newWords, 0);
    this.add
      .text(x + w, top, `${answers} answers · ${fresh} new words`, textStyle(18, COLORS.muted))
      .setOrigin(1, 0.5);

    const baseY = top + 190;
    const maxH = 125;
    const most = Math.max(1, ...days.map((d) => d.correct + d.wrong));
    const slot = w / days.length;
    const g = this.add.graphics();
    g.lineStyle(1, COLORS.enemy).lineBetween(x, baseY, x + w, baseY);
    days.forEach((d, i) => {
      const cx = x + slot * i + slot / 2;
      const barW = slot * 0.62;
      const rightH = (maxH * d.correct) / most;
      const wrongH = (maxH * d.wrong) / most;
      if (rightH > 0) g.fillStyle(MATURE_COLOR).fillRect(cx - barW / 2, baseY - rightH, barW, rightH);
      if (wrongH > 0) g.fillStyle(0xff6b7a).fillRect(cx - barW / 2, baseY - rightH - wrongH, barW, wrongH);
      const total = d.correct + d.wrong;
      if (total > 0) {
        this.add.text(cx, baseY - rightH - wrongH - 14, percent(d.correct / total), textStyle(14, COLORS.text)).setOrigin(0.5);
      }
      const date = new Date(`${d.key}T12:00:00`);
      const fromEnd = days.length - 1 - i;
      const label = fromEnd === 0 ? 'today' : fromEnd % 2 === 1 ? '' : `${date.getMonth() + 1}/${date.getDate()}`;
      if (label) this.add.text(cx, baseY + 18, label, textStyle(15, COLORS.muted)).setOrigin(0.5);
    });
    if (answers === 0) {
      this.add.text(x + w / 2, baseY - maxH / 2, 'Play a level to start your history', textStyle(22, COLORS.muted)).setOrigin(0.5);
    }
  }

  /** The most-missed words still being learned, with pinyin and meaning. */
  private async weakWords(x: number, top: number, w: number) {
    this.add.text(x, top, 'Needs work', textStyle(28, COLORS.accent)).setOrigin(0, 0.5);
    const weak = weakestWords(progress.entries(), WEAK_COUNT);
    if (weak.length === 0) {
      this.add.text(x, top + 60, 'No missed words yet. 加油!', textStyle(22, COLORS.muted)).setOrigin(0, 0.5);
      return;
    }
    const words = new Map<string, Word>();
    const levels = [...new Set(weak.map((w) => w.level))];
    for (const list of await Promise.all(levels.map(loadLevel))) for (const word of list) words.set(word.hanzi, word);

    const colW = w / 2;
    weak.forEach((weakWord, i) => {
      const cx = x + (i % 2) * colW;
      const cy = top + 58 + Math.floor(i / 2) * 62;
      const word = words.get(weakWord.hanzi);
      const hanzi = this.add.text(cx, cy, weakWord.hanzi, textStyle(weakWord.hanzi.length > 2 ? 26 : 34)).setOrigin(0, 0.5);
      const textX = cx + Math.max(hanzi.width, 70) + 12;
      const maxW = colW - (textX - cx) - 12;
      this.add
        .text(textX, cy - 13, `${word?.pinyin ?? ''}  ✗${weakWord.lapses}`, textStyle(19, COLORS.title))
        .setOrigin(0, 0.5);
      const gloss = this.add.text(textX, cy + 14, word?.gloss ?? '', textStyle(17, COLORS.muted)).setOrigin(0, 0.5);
      // Long glosses would run into the next column: cut them to fit.
      let text = gloss.text;
      while (gloss.width > maxW && text.length > 1) {
        text = text.slice(0, -1);
        gloss.setText(`${text.trimEnd()}…`);
      }
    });
  }
}
