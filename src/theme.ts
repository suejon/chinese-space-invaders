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
  player: 0x7cf7ff,
  bullet: 0xffe27a,
};

export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

export const textStyle = (size: number, color: string = COLORS.text): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: CJK_FONT,
  fontSize: `${size}px`,
  color,
});
