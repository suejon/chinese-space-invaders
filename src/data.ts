export interface Word {
  hanzi: string;
  trad: string;
  pinyin: string;
  gloss: string;
  meanings: string[];
  pos: string[];
  freq: number;
}

export interface LevelInfo {
  level: number;
  count: number;
  cumulative: number;
}

/** HSK 3.0 levels 1–6, plus 7 for the combined 7–9 band. */
export const levelName = (level: number) => (level === 7 ? 'HSK 7–9' : `HSK ${level}`);

const url = (path: string) => `${import.meta.env.BASE_URL}data/hsk/${path}`;

export async function loadIndex(): Promise<LevelInfo[]> {
  const res = await fetch(url('index.json'));
  return (await res.json()).levels;
}

export async function loadLevel(level: number): Promise<Word[]> {
  const res = await fetch(url(`${level}.json`));
  return res.json();
}
