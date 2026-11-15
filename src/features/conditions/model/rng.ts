/**
 * 确定性随机：只由 (seed, namespace, key, loopIndex) 决定。
 * 预览编排与音频调度都调用同一份纯函数，因此不会“各抽一次随机数”。
 * 结果与调用顺序无关——每个 (音符, 圈) 组合有独立的随机数。
 */
export function hashUnit(
  seed: number,
  namespace: string,
  key: string,
  loopIndex: number,
): number {
  // FNV-1a 32bit
  let h = 0x811c9dc5;
  const write = (value: string) => {
    for (let i = 0; i < value.length; i++) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  };
  write(`${seed}|${namespace}|${key}|${loopIndex}`);
  h >>>= 0;
  // mulberry32
  h += 0x6d2b79f5;
  let t = h;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
/** 生成可保存的新种子（uint32）。仅在用户主动换种子时使用，不参与逐圈抽取。 */
export function randomSeed() {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
export const clampSeed = (n: number) =>
  Math.max(0, Math.min(0xffffffff, Math.floor(Number.isFinite(n) ? n : 0)));
