export type Instrument = "drums" | "keys";
/**
 * 音符触发条件。缺省（undefined）即旧音符：每圈必定触发。
 * - probability: 该圈出现概率 0~1，由种子与圈序号决定，预览和调度共用同一结果
 * - every / phase: 仅当 loopIndex % every === phase 时触发（每几圈一次）
 * - prerequisiteId: 前置音符；要求它在“本圈内先于本音符的位置上”成功触发
 */
export type NoteCondition = {
  probability: number;
  every: number;
  phase: number;
  prerequisiteId: string | null;
};
export type Note = {
  id: string;
  pitch: number;
  beat: number;
  duration: number;
  velocity: number;
  condition?: NoteCondition;
};
export type Track = {
  id: string;
  name: string;
  instrument: Instrument;
  color: string;
  notes: Note[];
};
export type Channel = { volume: number; muted: boolean };
export type Session = {
  version: 2;
  title: string;
  bpm: number;
  beats: number;
  seed: number;
  tracks: Track[];
  channels: Record<string, Channel>;
  master: number;
};
export type NoteInput = {
  pitch: number;
  velocity: number;
  instrument: Instrument;
};
export type ScheduledNote = NoteInput & {
  duration: number;
  when: number;
  trackId: string;
};
export type Listener = () => void;
