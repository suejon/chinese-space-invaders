import Phaser from 'phaser';
import { levelName, loadHanzi, loadLevel, type Word } from '../data';
import { describeParts, type HanziData } from '../game/parts';
import { progress } from '../game/progress';
import { shuffle } from '../game/random';
import { history } from '../game/stats';
import { PATROL_MAX, patrolWaves, RunState } from '../game/run';
import { pickToneWave, sandhiNote, toneLabel, toneless, tonePair } from '../game/tones';
import { pickWave } from '../game/wave';
import { isMuted, speak, toggleMute } from '../speech';
import { COLORS, textStyle } from '../theme';

const COLS = 4;
const ENEMY_W = 136;
const ENEMY_H = 84;
const SPACING_X = 150;
const SPACING_Y = 106;
const FORMATION_TOP = 170;
const EDGE_MARGIN = 16;
const DROP = 28;
const DANGER_Y = 900;
const PLAYER_Y = 1170;
const PLAYER_SPEED = 520;
const BULLET_SPEED = 1100;
/** After a wrong hit the formation holds still this long, so the player can take in the right answer. */
const FEEDBACK_PAUSE = 1200;
const INFO_DURATION = 2800;
/** Tone waves use fewer ships than meaning waves: telling 8 patterns apart is plenty for a new skill. */
const TONE_SHIPS = 8;

// Typing the pinyin needs a physical keyboard; touch-only players keep shooting mature words instead.
let keyboardSeen = false;
window.addEventListener('keydown', () => (keyboardSeen = true), { once: true });

export type GameStart = { level: number } | { patrol: true };

interface Enemy {
  word: Word;
  column: number;
  container: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Rectangle;
}

/**
 * One run: waves of word-carrying ships; shoot the ship that matches the English prompt.
 * Mature words are answered by typing their pinyin instead, and one wave per level run drills tone pairs.
 */
export class GameScene extends Phaser.Scene {
  private run!: RunState;
  private pool: Word[] = [];
  /** HSK level of each word in the pool, for recording progress (a patrol mixes levels). */
  private levelOf = new Map<string, number>();
  private hanzi: HanziData | null = null;
  private enemies: Enemy[] = [];
  private waveTotal = 0;
  private formation!: Phaser.GameObjects.Container;
  private direction = 1;
  private target: Enemy | null = null;
  private player!: Phaser.GameObjects.Triangle;
  private bullet: Phaser.GameObjects.Rectangle | null = null;
  private moveTo: number | null = null;
  /** Ship the player tapped: the cannon tracks it and fires once underneath. */
  private fireAt: Enemy | null = null;
  private active = false;
  /** This wave's ships carry tone patterns and the prompt is a two-syllable word. */
  private toneWave = false;
  /** The current prompt was already answered wrong once, so a later right answer isn't recorded. */
  private promptMissed = false;
  /** The current prompt is for a mature word: type its pinyin to lock on and fire. */
  private recall = false;
  private typed = '';
  private frozenUntil = 0;
  private infoTimer: Phaser.Time.TimerEvent | null = null;

  private promptHeader!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private subText!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private shieldText!: Phaser.GameObjects.Text;
  private muteText!: Phaser.GameObjects.Text;
  private keys!: {
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    a: Phaser.Input.Keyboard.Key;
    d: Phaser.Input.Keyboard.Key;
    fire: Phaser.Input.Keyboard.Key;
  };

  constructor() {
    super('game');
  }

  init(data: GameStart) {
    // A patrol's waves depend on how many words are due, so its run is replaced once they are loaded.
    this.run = 'level' in data ? new RunState(data.level) : new RunState(0, 'patrol', []);
    this.pool = [];
    this.levelOf = new Map();
    this.enemies = [];
    this.bullet = null;
    this.target = null;
    this.moveTo = null;
    this.fireAt = null;
    this.active = false;
    this.toneWave = false;
    this.direction = 1;
    this.promptMissed = false;
    this.recall = false;
    this.typed = '';
    this.frozenUntil = 0;
    this.infoTimer = null;
  }

  async create() {
    const { width } = this.scale;

    this.scoreText = this.add.text(24, 30, '', textStyle(28));
    this.waveText = this.add.text(width / 2, 30, '', textStyle(28, COLORS.muted)).setOrigin(0.5, 0);
    this.shieldText = this.add.text(width - 24, 30, '', textStyle(28, COLORS.title)).setOrigin(1, 0);

    this.add.line(0, 0, 0, DANGER_Y, width, DANGER_Y, 0xff6b7a, 0.35).setOrigin(0);
    this.add
      .rectangle(width / 2, 1035, width - 40, 120, 0x111633)
      .setStrokeStyle(2, 0x2b3170)
      .setInteractive()
      .on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        // Tap the prompt to hear a tone-pair word again.
        if (!this.toneWave || !this.target) return;
        e.stopPropagation();
        speak(this.target.word.hanzi);
      });
    this.promptHeader = this.add.text(width / 2, 990, '', textStyle(20, COLORS.muted)).setOrigin(0.5);
    this.promptText = this.add.text(width / 2, 1035, '', textStyle(44, COLORS.accent)).setOrigin(0.5);
    this.subText = this.add.text(width / 2, 1078, '', textStyle(24, COLORS.title)).setOrigin(0.5);
    this.infoText = this.add.text(width / 2, 1118, '', textStyle(22, COLORS.text)).setOrigin(0.5);

    this.player = this.add.triangle(width / 2, PLAYER_Y, 0, 50, 34, 0, 68, 50, COLORS.player);

    this.muteText = this.add
      .text(width - 24, 1250, '', textStyle(22, COLORS.muted))
      .setOrigin(1, 1)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        this.toggleSound();
      });
    const label = this.run.kind === 'patrol' ? 'Daily patrol' : levelName(this.run.level);
    this.add.text(24, 1250, label, textStyle(22, COLORS.muted)).setOrigin(0, 1);

    const keyboard = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      left: keyboard.addKey(K.LEFT),
      right: keyboard.addKey(K.RIGHT),
      a: keyboard.addKey(K.A),
      d: keyboard.addKey(K.D),
      fire: keyboard.addKey(K.SPACE),
    };
    keyboard.on('keydown-M', () => !this.recall && this.toggleSound());
    keyboard.on('keydown', (event: KeyboardEvent) => this.onType(event));
    keyboard.on('keydown-ESC', () => this.scene.start('title'));

    // Touch / mouse: tap a ship to fly under it and fire; tap empty space to move there.
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.moveTo = Phaser.Math.Clamp(pointer.x, 40, width - 40);
      this.fireAt = null;
    });

    this.hanzi = await loadHanzi().catch(() => null);
    if (this.run.kind === 'patrol') {
      await this.loadPatrol();
      if (this.pool.length === 0) {
        this.add.text(width / 2, 560, 'Nothing due. Come back tomorrow!', textStyle(36, COLORS.title)).setOrigin(0.5);
        this.time.delayedCall(1800, () => this.scene.start('title'));
        return;
      }
    } else {
      this.pool = await loadLevel(this.run.level);
      for (const word of this.pool) this.levelOf.set(word.hanzi, this.run.level);
    }
    this.startWave();
  }

  /** Due words across all levels, padded with already-seen words when only a few are due. */
  private async loadPatrol() {
    let picks = progress.due().slice(0, PATROL_MAX);
    if (picks.length < 4) picks = [...picks, ...shuffle(progress.notDue(), Math.random).slice(0, 4 - picks.length)];
    const levels = [...new Set(picks.map((p) => p.level))];
    const words = new Map<string, Word>();
    for (const level of levels) for (const word of await loadLevel(level)) words.set(`${level}:${word.hanzi}`, word);
    for (const pick of picks) {
      const word = words.get(`${pick.level}:${pick.hanzi}`);
      if (!word) continue;
      this.pool.push(word);
      this.levelOf.set(word.hanzi, pick.level);
    }
    this.run = new RunState(0, 'patrol', patrolWaves(this.pool.length));
  }

  private toggleSound() {
    toggleMute();
    this.updateHud();
  }

  private updateHud() {
    this.scoreText.setText(`${this.run.score}`);
    this.waveText.setText(`Wave ${Math.min(this.run.wave + 1, this.run.waveCount)}/${this.run.waveCount}`);
    this.shieldText.setText('◆'.repeat(Math.max(this.run.shields, 0)));
    this.muteText.setText(isMuted() ? 'Sound off (M)' : 'Sound on (M)');
  }

  private startWave() {
    this.updateHud();
    const { width } = this.scale;
    this.setPrompt('', '', '');
    this.infoText.setText('');

    const size = this.run.waveSizes[this.run.wave];
    let words = this.run.isToneWave ? pickToneWave(this.pool, Math.min(size, TONE_SHIPS), Math.random) : [];
    if (words.length < 4) {
      // Not enough two-syllable words for a tone wave: fall back to a meaning wave.
      const seen = new Set(this.run.results.keys());
      const unseen = this.pool.filter((w) => !seen.has(w.hanzi));
      words = pickWave(this.pool, size, Math.random, unseen);
    }
    const tones = this.run.isToneWave && words.every((w) => tonePair(w));
    this.toneWave = tones;
    const bannerText = tones ? 'Tone pairs' : `Wave ${this.run.wave + 1}`;

    const banner = this.add.text(width / 2, 560, bannerText, textStyle(64, COLORS.title)).setOrigin(0.5);
    this.formation?.destroy();
    this.formation = this.add.container(0, FORMATION_TOP);
    const rows = Math.ceil(words.length / COLS);
    const left = (width - (COLS - 1) * SPACING_X) / 2;
    this.enemies = words.map((word, i) => {
      const x = left + (i % COLS) * SPACING_X;
      const y = Math.floor(i / COLS) * SPACING_Y;
      const frame = this.add.rectangle(0, 0, ENEMY_W, ENEMY_H, COLORS.enemy).setStrokeStyle(2, COLORS.enemyEdge);
      const text = tones ? toneLabel(tonePair(word)!) : word.hanzi;
      const size = tones ? 30 : word.hanzi.length <= 2 ? 44 : word.hanzi.length === 3 ? 36 : 28;
      const label = this.add.text(0, 0, text, { ...textStyle(size), align: 'center', lineSpacing: -4 }).setOrigin(0.5);
      const container = this.add.container(x, y, [frame, label]);
      container.setSize(ENEMY_W, ENEMY_H).setInteractive({ useHandCursor: true });
      const enemy: Enemy = { word, column: i % COLS, container, frame };
      container.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        // A typed prompt can't be answered by tapping a ship.
        if (!this.recall) this.fireAt = enemy;
      });
      this.formation.add(container);
      return enemy;
    });
    this.waveTotal = this.enemies.length;
    this.formation.setY(FORMATION_TOP - rows * 10);
    this.direction = 1;

    this.active = false;
    this.tweens.add({
      targets: banner,
      alpha: 0,
      delay: 700,
      duration: 400,
      onComplete: () => {
        banner.destroy();
        this.active = true;
        this.nextPrompt();
      },
    });
  }

  /** The lowest ship in each column: the only ones a bullet can reach. */
  private exposed(): Enemy[] {
    const front = new Map<number, Enemy>();
    for (const enemy of this.enemies) {
      const current = front.get(enemy.column);
      if (!current || enemy.container.y > current.container.y) front.set(enemy.column, enemy);
    }
    return [...front.values()];
  }

  /** Prompt for an exposed ship, so the answer is always shootable; avoid repeating the last prompt. */
  private nextPrompt() {
    const exposed = this.exposed();
    // Dim ships hidden behind others so it is clear which ones can be hit.
    for (const enemy of this.enemies) enemy.container.setAlpha(exposed.includes(enemy) ? 1 : 0.5);
    const fresh = exposed.filter((e) => e !== this.target);
    const choices = fresh.length > 0 ? fresh : exposed;
    this.target = choices[Math.floor(Math.random() * choices.length)] ?? null;
    this.promptMissed = false;
    this.typed = '';
    const word = this.target?.word;
    this.recall = false;
    if (!word) this.setPrompt('', '', '');
    else if (this.toneWave) {
      this.setPrompt('SHOOT THE TONES OF', word.hanzi, word.gloss);
      // Wait for the last hit word's audio to finish before saying the new one.
      this.time.delayedCall(900, () => this.target?.word === word && speak(word.hanzi));
    } else if (keyboardSeen && progress.isMature(word.hanzi)) {
      // Well-known words move from recognition (shooting) to recall (typing the pinyin).
      this.recall = true;
      this.setPrompt('TYPE THE PINYIN FOR', word.gloss, '›  _');
    } else {
      this.setPrompt('SHOOT THE WORD FOR', word.gloss, '');
    }
  }

  private setPrompt(header: string, prompt: string, sub: string) {
    this.promptHeader.setText(header);
    this.promptText.setText(prompt);
    this.subText.setText(sub).setColor(COLORS.title);
  }

  /** Typing for recall prompts: letters build the pinyin; a full match locks on to that ship and fires. */
  private onType(event: KeyboardEvent) {
    if (!this.recall || !this.active || this.fireAt) return;
    if (event.key === 'Backspace') this.typed = this.typed.slice(0, -1);
    else if (event.key === 'Enter') return this.lockOn(true);
    else if (/^[a-zü]$/i.test(event.key)) this.typed += event.key.toLowerCase();
    else return;
    this.subText.setText(`›  ${this.typed}_`).setColor(COLORS.title);
    this.lockOn(false);
  }

  /**
   * Fire at the exposed ship whose pinyin was typed (tones optional). Locks on as soon as the
   * letters match one ship and can't be the start of another; Enter forces it.
   */
  private lockOn(submit: boolean) {
    const typed = toneless(this.typed);
    if (!typed) return;
    const exposed = this.exposed();
    const matches = exposed.filter((e) => toneless(e.word.pinyin) === typed);
    const match = matches.find((e) => e === this.target) ?? matches[0];
    const longer = exposed.some((e) => {
      const pinyin = toneless(e.word.pinyin);
      return pinyin !== typed && pinyin.startsWith(typed);
    });
    if (match && (submit || !longer)) {
      this.fireAt = match;
      this.subText.setText(`›  ${this.typed}`).setColor(COLORS.good);
      this.typed = '';
    } else if (submit) {
      this.subText.setText(`›  ${this.typed}  ✗`).setColor(COLORS.bad);
      this.typed = '';
    }
  }

  update(_time: number, deltaMs: number) {
    if (!this.active) return;
    const dt = deltaMs / 1000;
    this.updatePlayer(dt);
    this.updateBullet(dt);
    this.updateFormation(dt);
  }

  private updatePlayer(dt: number) {
    const { width } = this.scale;
    // While typing pinyin, A and D are letters, not movement.
    const leftDown = this.keys.left.isDown || (!this.recall && this.keys.a.isDown);
    const rightDown = this.keys.right.isDown || (!this.recall && this.keys.d.isDown);
    if (this.fireAt && !this.enemies.includes(this.fireAt)) this.fireAt = null;
    if (this.fireAt) this.moveTo = this.formation.x + this.fireAt.container.x;
    if (leftDown || rightDown) {
      this.moveTo = null;
      this.fireAt = null;
      this.player.x += (rightDown ? 1 : -1) * PLAYER_SPEED * dt;
    } else if (this.moveTo !== null) {
      const step = PLAYER_SPEED * 1.4 * dt;
      const delta = this.moveTo - this.player.x;
      this.player.x += Phaser.Math.Clamp(delta, -step, step);
      if (Math.abs(delta) <= step) {
        this.moveTo = null;
        if (this.fireAt) {
          this.fireAt = null;
          this.fire();
        }
      }
    }
    this.player.x = Phaser.Math.Clamp(this.player.x, 40, width - 40);
    if (Phaser.Input.Keyboard.JustDown(this.keys.fire) && !this.recall) this.fire();
  }

  /** One bullet on screen at a time, as in the original: guessing has a cost. */
  private fire() {
    if (this.bullet) return;
    this.bullet = this.add.rectangle(this.player.x, PLAYER_Y - 30, 6, 26, COLORS.bullet);
  }

  private updateBullet(dt: number) {
    if (!this.bullet) return;
    this.bullet.y -= BULLET_SPEED * dt;
    if (this.bullet.y < 0) {
      this.clearBullet();
      return;
    }
    const tip = new Phaser.Geom.Point(this.bullet.x, this.bullet.y - 13);
    const hit = this.enemies.find((e) => Phaser.Geom.Rectangle.ContainsPoint(e.container.getBounds(), tip));
    if (hit) {
      this.clearBullet();
      this.onHit(hit);
    }
  }

  private clearBullet() {
    this.bullet?.destroy();
    this.bullet = null;
  }

  private onHit(enemy: Enemy) {
    const target = this.target;
    if (!target) return;
    const x = this.formation.x + enemy.container.x;
    const y = this.formation.y + enemy.container.y;

    const tones = this.toneWave;
    if (enemy === target) {
      const word = enemy.word;
      const points = this.run.hit(word);
      speak(word.hanzi);
      this.floatText(x, y, `${word.hanzi} ${word.pinyin}  +${points}`, COLORS.good);
      if (tones) {
        const note = sandhiNote(tonePair(word)!);
        if (note) this.showInfo(`${word.hanzi}: ${note}`);
      } else {
        // First time ever: show how the characters are built, now that the word is on screen.
        if (progress.isNew(word.hanzi)) this.showParts(word);
        if (!this.promptMissed) this.record(word, true);
      }
      this.explode(x, y);
      enemy.container.destroy();
      this.enemies = this.enemies.filter((e) => e !== enemy);
      this.updateHud();
      if (this.enemies.length === 0) {
        this.run.wave++;
        this.active = false;
        if (this.run.isWon) this.endRun();
        else this.time.delayedCall(600, () => this.startWave());
      } else {
        this.nextPrompt();
      }
      return;
    }

    this.run.miss(target.word, enemy.word);
    if (!tones && !this.promptMissed) this.record(target.word, false);
    this.promptMissed = true;
    this.updateHud();
    this.cameras.main.shake(180, 0.008);
    this.floatText(x, y, tones ? `${enemy.word.hanzi} ${enemy.word.pinyin}` : `${enemy.word.hanzi} = ${enemy.word.gloss}`, COLORS.bad);
    this.flash(enemy.frame, 0xff6b7a);
    // Teach the right answer so a wrong pick isn't what sticks: highlight it, say it, show its
    // pinyin and how it is built, and hold the formation still for a moment. The prompt stays the same.
    const tx = this.formation.x + target.container.x;
    const ty = this.formation.y + target.container.y;
    this.flash(target.frame, 0xffe27a, FEEDBACK_PAUSE);
    this.floatText(tx, ty + 40, `${target.word.hanzi} ${target.word.pinyin}`, COLORS.accent);
    speak(target.word.hanzi);
    if (tones) this.showInfo(`${target.word.hanzi} ${target.word.pinyin}  ${sandhiNote(tonePair(target.word)!) ?? ''}`);
    else this.showParts(target.word);
    this.frozenUntil = this.time.now + FEEDBACK_PAUSE;
    if (this.recall) this.subText.setText('›  _').setColor(COLORS.title);
    if (this.run.isOver) this.endRun();
  }

  private record(word: Word, correct: boolean) {
    history.answer(correct, progress.isNew(word.hanzi));
    progress.review(word.hanzi, this.levelOf.get(word.hanzi) ?? this.run.level, { correct, recall: this.recall });
  }

  private showParts(word: Word) {
    if (this.hanzi) this.showInfo(describeParts(word, this.hanzi));
  }

  private showInfo(text: string) {
    if (!text.trim()) return;
    this.infoText.setText(text.trim());
    this.infoTimer?.remove();
    this.infoTimer = this.time.delayedCall(INFO_DURATION, () => this.infoText.setText(''));
  }

  private updateFormation(dt: number) {
    if (this.enemies.length === 0 || this.time.now < this.frozenUntil) return;
    const { width } = this.scale;
    const cleared = 1 - this.enemies.length / this.waveTotal;
    const speed = (30 + 10 * this.run.wave) * (1 + cleared * 0.8);
    this.formation.x += this.direction * speed * dt;

    const xs = this.enemies.map((e) => this.formation.x + e.container.x);
    const minX = Math.min(...xs) - ENEMY_W / 2;
    const maxX = Math.max(...xs) + ENEMY_W / 2;
    if ((this.direction > 0 && maxX > width - EDGE_MARGIN) || (this.direction < 0 && minX < EDGE_MARGIN)) {
      this.direction *= -1;
      this.formation.y += DROP;
    }

    const bottom = this.formation.y + Math.max(...this.enemies.map((e) => e.container.y)) + ENEMY_H / 2;
    if (bottom >= DANGER_Y) {
      this.run.invaded = true;
      this.endRun();
    }
  }

  private endRun() {
    this.active = false;
    this.clearBullet();
    this.time.delayedCall(900, () => this.scene.start('results', { run: this.run }));
  }

  private floatText(x: number, y: number, text: string, color: string) {
    const label = this.add.text(x, y - 50, text, textStyle(28, color)).setOrigin(0.5);
    label.setX(Phaser.Math.Clamp(x, label.width / 2 + 8, this.scale.width - label.width / 2 - 8));
    this.tweens.add({ targets: label, y: y - 120, alpha: 0, duration: 1400, onComplete: () => label.destroy() });
  }

  private explode(x: number, y: number) {
    for (let i = 0; i < 10; i++) {
      const shard = this.add.rectangle(x, y, 8, 8, COLORS.enemyEdge);
      const angle = (Math.PI * 2 * i) / 10;
      this.tweens.add({
        targets: shard,
        x: x + Math.cos(angle) * 70,
        y: y + Math.sin(angle) * 70,
        alpha: 0,
        duration: 450,
        onComplete: () => shard.destroy(),
      });
    }
  }

  private flash(frame: Phaser.GameObjects.Rectangle, color: number, duration = 400) {
    if (!frame.active) return;
    frame.setStrokeStyle(5, color);
    this.time.delayedCall(duration, () => frame.active && frame.setStrokeStyle(2, COLORS.enemyEdge));
  }
}
