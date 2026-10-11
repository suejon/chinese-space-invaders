import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { ResultsScene } from './scenes/ResultsScene';
import { TitleScene } from './scenes/TitleScene';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from './theme';

// Load the CJK web font before Phaser draws any text, or the first frames render in a fallback font.
await document.fonts.load(`32px "Noto Sans SC"`, '汉字').catch(() => undefined);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: COLORS.background,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: GAME_WIDTH, height: GAME_HEIGHT },
  scene: [TitleScene, GameScene, ResultsScene],
});

// Handy for poking at scenes from the browser console during development.
if (import.meta.env.DEV) Object.assign(window, { game });
