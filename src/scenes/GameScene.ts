import Phaser from 'phaser';
import { levelName, loadLevel, type Word } from '../data';
import { RunState, WAVE_SIZES } from '../game/run';
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

interface Enemy {
  word: Word;
  column: number;
  container: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Rectangle;
}

/** One run: waves of word-carrying ships; shoot the ship that matches the English prompt. */
export class GameScene extends Phaser.Scene {
  private run!: RunState;
  private pool: Word[] = [];
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

  private promptText!: Phaser.GameObjects.Text;
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

  init(data: { level: number }) {
    this.run = new RunState(data.level ?? 1);
    this.enemies = [];
    this.bullet = null;
    this.target = null;
    this.moveTo = null;
    this.fireAt = null;
    this.active = false;
    this.direction = 1;
  }

  async create() {
    const { width } = this.scale;

    this.scoreText = this.add.text(24, 30, '', textStyle(28));
    this.waveText = this.add.text(width / 2, 30, '', textStyle(28, COLORS.muted)).setOrigin(0.5, 0);
    this.shieldText = this.add.text(width - 24, 30, '', textStyle(28, COLORS.title)).setOrigin(1, 0);

    this.add.line(0, 0, 0, DANGER_Y, width, DANGER_Y, 0xff6b7a, 0.35).setOrigin(0);
    this.add.rectangle(width / 2, 1035, width - 40, 120, 0x111633).setStrokeStyle(2, 0x2b3170);
    this.add.text(width / 2, 990, 'SHOOT THE WORD FOR', textStyle(20, COLORS.muted)).setOrigin(0.5);
    this.promptText = this.add.text(width / 2, 1045, '', textStyle(44, COLORS.accent)).setOrigin(0.5);

    this.player = this.add.triangle(width / 2, PLAYER_Y, 0, 50, 34, 0, 68, 50, COLORS.player);

    this.muteText = this.add
      .text(width - 24, 1250, '', textStyle(22, COLORS.muted))
      .setOrigin(1, 1)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        this.toggleSound();
      });
    this.add.text(24, 1250, levelName(this.run.level), textStyle(22, COLORS.muted)).setOrigin(0, 1);

    const keyboard = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      left: keyboard.addKey(K.LEFT),
      right: keyboard.addKey(K.RIGHT),
      a: keyboard.addKey(K.A),
      d: keyboard.addKey(K.D),
      fire: keyboard.addKey(K.SPACE),
    };
    keyboard.on('keydown-M', () => this.toggleSound());
    keyboard.on('keydown-ESC', () => this.scene.start('title'));

    // Touch / mouse: tap a ship to fly under it and fire; tap empty space to move there.
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.moveTo = Phaser.Math.Clamp(pointer.x, 40, width - 40);
      this.fireAt = null;
    });

    this.updateHud();
    this.pool = await loadLevel(this.run.level);
    this.startWave();
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
    const banner = this.add.text(width / 2, 560, `Wave ${this.run.wave + 1}`, textStyle(64, COLORS.title)).setOrigin(0.5);
    this.promptText.setText('');

    const seen = new Set(this.run.results.keys());
    const unseen = this.pool.filter((w) => !seen.has(w.hanzi));
    const words = pickWave(this.pool, WAVE_SIZES[this.run.wave], Math.random, unseen);

    this.formation?.destroy();
    this.formation = this.add.container(0, FORMATION_TOP);
    const rows = Math.ceil(words.length / COLS);
    const left = (width - (COLS - 1) * SPACING_X) / 2;
    this.enemies = words.map((word, i) => {
      const x = left + (i % COLS) * SPACING_X;
      const y = Math.floor(i / COLS) * SPACING_Y;
      const frame = this.add.rectangle(0, 0, ENEMY_W, ENEMY_H, COLORS.enemy).setStrokeStyle(2, COLORS.enemyEdge);
      const size = word.hanzi.length <= 2 ? 44 : word.hanzi.length === 3 ? 36 : 28;
      const label = this.add.text(0, 0, word.hanzi, textStyle(size)).setOrigin(0.5);
      const container = this.add.container(x, y, [frame, label]);
      container.setSize(ENEMY_W, ENEMY_H).setInteractive({ useHandCursor: true });
      const enemy: Enemy = { word, column: i % COLS, container, frame };
      container.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        this.fireAt = enemy;
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
    this.promptText.setText(this.target ? this.target.word.gloss : '');
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
    const leftDown = this.keys.left.isDown || this.keys.a.isDown;
    const rightDown = this.keys.right.isDown || this.keys.d.isDown;
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
    if (Phaser.Input.Keyboard.JustDown(this.keys.fire)) this.fire();
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

    if (enemy === target) {
      const points = this.run.hit(enemy.word);
      speak(enemy.word.hanzi);
      this.floatText(x, y, `${enemy.word.hanzi} ${enemy.word.pinyin}  +${points}`, COLORS.good);
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
    this.updateHud();
    this.cameras.main.shake(180, 0.008);
    this.floatText(x, y, `${enemy.word.hanzi} = ${enemy.word.gloss}`, COLORS.bad);
    this.flash(enemy.frame, 0xff6b7a);
    // Show the right answer so the miss teaches something; the prompt stays the same.
    this.flash(target.frame, 0xffe27a, 1200);
    if (this.run.isOver) this.endRun();
  }

  private updateFormation(dt: number) {
    if (this.enemies.length === 0) return;
    const { width } = this.scale;
    const progress = 1 - this.enemies.length / this.waveTotal;
    const speed = (30 + 10 * this.run.wave) * (1 + progress * 0.8);
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
