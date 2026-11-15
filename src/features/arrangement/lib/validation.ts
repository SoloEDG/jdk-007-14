import type { Session, Track, Note, NoteCondition } from "@/shared/types";
import { validateConditions } from "@/features/conditions";
const object = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const finite = (x: unknown, min: number, max: number): x is number =>
  typeof x === "number" && Number.isFinite(x) && x >= min && x <= max;
function normalizeCondition(raw: unknown): NoteCondition | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!object(raw)) throw new Error("触发条件数据无效");
  if (
    !finite(raw.probability, 0, 1) ||
    !Number.isInteger(raw.every) ||
    (raw.every as number) < 1 ||
    (raw.every as number) > 64 ||
    !Number.isInteger(raw.phase) ||
    (raw.phase as number) < 0 ||
    (raw.phase as number) >= (raw.every as number) ||
    (raw.prerequisiteId !== null && typeof raw.prerequisiteId !== "string")
  )
    throw new Error("触发条件数据无效");
  return {
    probability: raw.probability as number,
    every: raw.every as number,
    phase: raw.phase as number,
    prerequisiteId: raw.prerequisiteId as string | null,
  };
}
export function validateSession(raw: unknown): Session {
  if (
    !object(raw) ||
    ![1, 2].includes(raw.version as number) ||
    typeof raw.title !== "string" ||
    raw.title.length > 80 ||
    !finite(raw.bpm, 40, 220) ||
    ![4, 8, 16, 32].includes(raw.beats as number) ||
    !Array.isArray(raw.tracks) ||
    raw.tracks.length > 8 ||
    !object(raw.channels) ||
    !finite(raw.master, 0, 1)
  )
    throw new Error("存档格式或版本不受支持");
  // v1 存档没有种子：迁移为固定种子，旧行为（每圈相同）完整保留
  let seed = 1;
  if (raw.version === 2) {
    if (
      !Number.isInteger(raw.seed) ||
      (raw.seed as number) < 0 ||
      (raw.seed as number) > 0xffffffff
    )
      throw new Error("随机种子无效");
    seed = raw.seed as number;
  }
  const ids = new Set<string>();
  const noteIds = new Set<string>();
  const tracks: Track[] = [];
  for (const value of raw.tracks) {
    if (!object(value)) throw new Error("轨道损坏");
    const t = value as unknown as Track;
    if (
      typeof t.id !== "string" ||
      ids.has(t.id) ||
      !t.id ||
      typeof t.name !== "string" ||
      t.name.length > 32 ||
      !["drums", "keys"].includes(t.instrument) ||
      !/^#[0-9a-f]{6}$/i.test(t.color) ||
      !Array.isArray(t.notes) ||
      t.notes.length > 2048
    )
      throw new Error("轨道数据无效");
    ids.add(t.id);
    const notes: Note[] = [];
    for (const n of t.notes as Note[]) {
      if (
        !object(n) ||
        typeof n.id !== "string" ||
        noteIds.has(n.id) ||
        !finite(
          n.pitch,
          t.instrument === "drums" ? 0 : 24,
          t.instrument === "drums" ? 3 : 108,
        ) ||
        !Number.isInteger(n.pitch) ||
        !finite(n.beat, 0, (raw.beats as number) - 0.000001) ||
        !finite(n.duration, 0.01, raw.beats as number) ||
        !finite(n.velocity, 0.01, 1)
      )
        throw new Error("音符数据无效");
      noteIds.add(n.id);
      const condition = normalizeCondition((n as Record<string, unknown>).condition);
      notes.push({
        id: n.id,
        pitch: n.pitch,
        beat: n.beat,
        duration: n.duration,
        velocity: n.velocity,
        ...(condition ? { condition } : {}),
      });
    }
    const track: Track = {
      id: t.id,
      name: t.name,
      instrument: t.instrument,
      color: t.color,
      notes,
    };
    const conditionError = validateConditions(track);
    if (conditionError) throw new Error(conditionError);
    const c = raw.channels[t.id];
    if (!object(c) || !finite(c.volume, 0, 1) || typeof c.muted !== "boolean")
      throw new Error("混音数据无效");
    tracks.push(track);
  }
  return {
    version: 2,
    title: raw.title,
    bpm: raw.bpm as number,
    beats: raw.beats as number,
    seed,
    tracks,
    channels: structuredClone(raw.channels) as Session["channels"],
    master: raw.master as number,
  };
}
