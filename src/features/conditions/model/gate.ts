import type { Note, NoteCondition, Track } from "@/shared/types";
import { hashUnit } from "./rng";
export const defaultCondition = (): NoteCondition => ({
  probability: 1,
  every: 1,
  phase: 0,
  prerequisiteId: null,
});
export const hasCondition = (note: Note) => note.condition !== undefined;
/**
 * 校验单轨的全部条件。返回错误文案；null 表示通过。
 * 规则：
 *  - 概率 ∈ [0,1]；every 为 1..64 的整数；phase ∈ [0, every-1]
 *  - 前置音符必须存在、不能指向自己，且必须位于本音符之前（beat 严格更小）
 *  - 再用 DFS 兜底检测成环依赖
 */
export function validateConditions(track: Track): string | null {
  const byId = new Map(track.notes.map((n) => [n.id, n]));
  for (const note of track.notes) {
    const c = note.condition;
    if (!c) continue;
    if (
      typeof c.probability !== "number" ||
      !Number.isFinite(c.probability) ||
      c.probability < 0 ||
      c.probability > 1
    )
      return `音符 ${note.id} 的出现概率无效`;
    if (!Number.isInteger(c.every) || c.every < 1 || c.every > 64)
      return `音符 ${note.id} 的“每几圈”必须是 1~64 的整数`;
    if (!Number.isInteger(c.phase) || c.phase < 0 || c.phase >= c.every)
      return `音符 ${note.id} 的相位必须在 0 到 ${c.every - 1} 之间`;
    if (c.prerequisiteId !== null) {
      if (c.prerequisiteId === note.id)
        return "音符不能把自己设为前置事件";
      const pre = byId.get(c.prerequisiteId);
      if (!pre) return "存在缺失的前置事件，条件未应用，原内容已保留";
      if (!(pre.beat < note.beat))
        return "前置音符必须先于本音符出现，条件未应用，原内容已保留";
    }
  }
  // DFS 成环检测（beat 顺序规则理论上已排除，这里作为存档损坏的兜底）
  const state = new Map<string, 0 | 1 | 2>();
  const visit = (id: string): boolean => {
    const mark = state.get(id) ?? 0;
    if (mark === 1) return true;
    if (mark === 2) return false;
    state.set(id, 1);
    const pre = byId.get(id)?.condition?.prerequisiteId;
    const cyclic = pre !== null && pre !== undefined && visit(pre);
    state.set(id, 2);
    return cyclic;
  };
  for (const n of track.notes)
    if (visit(n.id))
      return "循环条件互相依赖（成环），条件未应用，原内容已保留";
  return null;
}
/**
 * 计算某条轨道在指定圈实际会演奏哪些音符。
 * 纯函数：相同 (track, seed, loopIndex) 永远得到相同结果，
 * 时间轴预览与调度器共用，不存在第二次随机抽取。
 */
export function evaluateTrack(
  track: Track,
  seed: number,
  loopIndex: number,
): Map<string, boolean> {
  const fires = new Map<string, boolean>();
  // 按拍位升序，保证前置判定时结果已就绪；同拍位保持原顺序
  const ordered = track.notes
    .map((note, i) => ({ note, i }))
    .sort((a, b) => a.note.beat - b.note.beat || a.i - b.i);
  for (const { note } of ordered) {
    const c = note.condition;
    if (!c) {
      fires.set(note.id, true);
      continue;
    }
    if (loopIndex % c.every !== c.phase) {
      fires.set(note.id, false);
      continue;
    }
    // probability 为 1 时无需哈希；为 0 时必然不触发
    const passed =
      c.probability >= 1
        ? true
        : c.probability <= 0
          ? false
          : hashUnit(seed, track.id, note.id, loopIndex) < c.probability;
    const preOk =
      c.prerequisiteId === null || fires.get(c.prerequisiteId) === true;
    fires.set(note.id, passed && preOk);
  }
  return fires;
}
/** 把某一圈的实际演奏结果烘焙成确定音符：触发的保留并清除条件，未触发的移除。 */
export function bakeLoop(track: Track, seed: number, loopIndex: number): Track["notes"] {
  const fires = evaluateTrack(track, seed, loopIndex);
  return track.notes
    .filter((n) => fires.get(n.id) === true)
    .map((n) => {
      const { condition: _drop, ...rest } = n;
      return rest;
    });
}
