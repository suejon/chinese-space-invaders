import Phaser from 'phaser';
import { TitleScene } from './scenes/TitleScene';


// Load the CJK web font before Phaser draws any text, or the first frames render in a fallback font.
await document.fonts.load(`32px "Noto Sans SC"`, '汉字').catch(() => undefined);

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#05060f',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 720, height: 1280 },
  scene: [TitleScene],
});
