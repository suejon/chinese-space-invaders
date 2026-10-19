export const CJK_FONT = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';

export const COLORS = {
  background: '#05060f',
  title: '#7cf7ff',
  text: '#ffffff',
  muted: '#8a93c9',
  accent: '#ffe27a',
  good: '#6dff9c',
  bad: '#ff6b7a',
  enemy: 0x2b3170,
  enemyEdge: 0x7cf7ff,
  accentEdge: 0x6dff9c,
  player: 0x7cf7ff,
  bullet: 0xffe27a,
};

/** Phones and tablets: a finger for a pointer and usually no physical keyboard. */
export const TOUCH = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

export const GAME_WIDTH = 720;
/** Height of the playfield and HUD; every scene lays itself out in this. */
export const PLAY_HEIGHT = 1280;
/** Touch screens get a band under the playfield for on-screen keys, which also suits tall phone screens. */
export const KEYPAD_HEIGHT = TOUCH ? 260 : 0;
export const GAME_HEIGHT = PLAY_HEIGHT + KEYPAD_HEIGHT;

export const textStyle = (size: number, color: string = COLORS.text): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: CJK_FONT,
  fontSize: `${size}px`,
  color,
});
