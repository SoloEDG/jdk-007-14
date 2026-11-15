import type { Session, Note, NoteCondition } from "@/shared/types";
const note = (
  pitch: number,
  beat: number,
  duration = 0.18,
  velocity = 0.8,
  condition?: NoteCondition,
): Note => ({
  id: crypto.randomUUID(),
  pitch,
  beat,
  duration,
  velocity,
  ...(condition ? { condition } : {}),
});
const cond = (
  probability = 1,
  every = 1,
  phase = 0,
  prerequisiteId: string | null = null,
): NoteCondition => ({ probability, every, phase, prerequisiteId });
export function demoSession(): Session {
  // 先建好带条件的旋律，再把个别音符挂为前置，展示依赖链
  const lead = [72, 67, 69, 64, 67, 64, 62, 60].map((p, i) =>
    note(p, i * 2, 0.8, 0.55, i % 2 === 1 ? cond(0.7) : undefined),
  );
  // 第 5 个旋律音（beat 8）以前一个旋律音（beat 6）成功为前提
  lead[4] = { ...lead[4], condition: cond(1, 1, 0, lead[3].id) };
  return {
    version: 2,
    title: "凌晨两点 / After Hours",
    bpm: 108,
    beats: 16,
    seed: 20261115,
    master: 0.7,
    channels: {
      rhythm: { volume: 0.8, muted: false },
      chords: { volume: 0.55, muted: false },
      lead: { volume: 0.55, muted: false },
    },
    tracks: [
      {
        id: "rhythm",
        name: "午夜鼓组",
        instrument: "drums",
        color: "#d5f377",
        notes: Array.from({ length: 16 }, (_, i) => [
          // 底鼓每 2 圈才加花一次
          note(2, i, 0.12, 0.45, i === 14 ? cond(1, 2, 1) : undefined),
          ...(i % 4 === 0 || i % 4 === 2 ? [note(0, i)] : []),
          ...(i % 4 === 1 || i % 4 === 3
            ? [note(1, i, 0.2, 0.65, i === 15 ? cond(0.5) : undefined)]
            : []),
        ]).flat(),
      },
      {
        id: "chords",
        name: "温暖和弦",
        instrument: "keys",
        color: "#bca5f4",
        notes: [0, 4, 8, 12].flatMap((b, i) =>
          [60, 64, 67].map((p) =>
            note(p + (i % 2 === 1 ? -3 : 0), b, 3.6, 0.4),
          ),
        ),
      },
      {
        id: "lead",
        name: "夜间旋律",
        instrument: "keys",
        color: "#8fbfff",
        notes: lead,
      },
    ],
  };
}
