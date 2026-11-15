import type { Track, Instrument, Note, NoteCondition, Session } from "@/shared/types";
import { uid } from "@/shared/math";
import { validateSession } from "../lib/validation";
import { validateConditions, bakeLoop } from "@/features/conditions";
import { clampSeed } from "@/features/conditions";
type Pending =
  | { kind: "condition"; trackId: string; noteId: string; condition: NoteCondition | null }
  | { kind: "seed"; seed: number }
  | { kind: "bake"; trackId: string; loopIndex: number };
export function createArrangement() {
  let tracks: Track[] = [],
    selected: string | null = null,
    selectedNote: string | null = null,
    title = "未命名夜航",
    seed = 1,
    pending: Pending[] = [];
  const colors = [
    "#d5f377",
    "#bca5f4",
    "#8fbfff",
    "#f4af84",
    "#80cfbb",
    "#ed94b4",
    "#cec080",
    "#a6b6c9",
  ];
  const findTrack = (id: string) => tracks.find((t) => t.id === id);
  const noteTrack = (noteId: string) =>
    tracks.find((t) => t.notes.some((n) => n.id === noteId));
  return {
    snapshot() {
      return {
        tracks: structuredClone(tracks),
        selected,
        selectedNote,
        title,
        seed,
        pending: pending.map((p) => ({ ...p })),
      };
    },
    selected() {
      const t = findTrack(selected ?? "");
      return t ? structuredClone(t) : null;
    },
    select(id: string) {
      if (tracks.some((t) => t.id === id)) {
        selected = id;
        selectedNote = null;
      }
    },
    selectNote(noteId: string | null) {
      if (noteId === null) {
        selectedNote = null;
        return;
      }
      const t = noteTrack(noteId);
      if (t) {
        selected = t.id;
        selectedNote = noteId;
      }
    },
    add(instrument: Instrument) {
      if (tracks.length >= 8)
        throw new Error("最多支持 8 条轨道，请先移除一条");
      const t: Track = {
        id: uid(),
        name: `${instrument === "drums" ? "鼓组" : "琴键"} ${tracks.length + 1}`,
        instrument,
        color: colors[tracks.length % colors.length],
        notes: [],
      };
      tracks = [...tracks, t];
      selected = t.id;
      selectedNote = null;
      return t.id;
    },
    remove(id: string) {
      tracks = tracks.filter((t) => t.id !== id);
      pending = pending.filter((p) => ("trackId" in p ? p.trackId !== id : true));
      if (selected === id) {
        selected = tracks[0]?.id ?? null;
        selectedNote = null;
      }
    },
    commit(id: string, notes: Note[]) {
      if (!findTrack(id)) throw new Error("录音目标已不存在");
      tracks = tracks.map((t) =>
        t.id === id ? { ...t, notes: structuredClone(notes) } : t,
      );
      if (!findTrack(id)?.notes.some((n) => n.id === selectedNote))
        selectedNote = null;
    },
    /**
     * 录音提交两种模式（内容与保存方式清楚区分）：
     *  - bake：把听到的一整圈烘焙成确定音符，清掉全部条件
     *  - evolve：保留轨道上已有条件继续演化，新录音符作为无条件音符并入
     */
    commitTake(id: string, take: Note[], mode: "bake" | "evolve") {
      const track = findTrack(id);
      if (!track) throw new Error("录音目标已不存在");
      const notes =
        mode === "bake"
          ? structuredClone(take)
          : [
              ...track.notes,
              ...take.filter((n) => !track.notes.some((o) => o.id === n.id)),
            ];
      this.commit(id, notes);
      pending = pending.filter((p) => ("trackId" in p ? p.trackId !== id : true));
      return mode;
    },
    resizeLoop(beats: number) {
      tracks = tracks.map((track) => ({
        ...track,
        notes: track.notes
          .filter((note) => note.beat < beats)
          .map((note) => ({
            ...note,
            duration: Math.min(note.duration, beats - note.beat),
          })),
      }));
      selectedNote =
        selectedNote && noteTrack(selectedNote) ? selectedNote : null;
    },
    clear(id: string) {
      this.commit(id, []);
      pending = pending.filter((p) => ("trackId" in p ? p.trackId !== id : true));
    },
    restore(raw: Session) {
      const session = validateSession(raw);
      tracks = session.tracks;
      title = session.title;
      seed = session.seed;
      pending = [];
      selected = tracks[0]?.id ?? null;
      selectedNote = null;
      return session;
    },
    forPlayback() {
      return structuredClone(tracks);
    },
    getSeed() {
      return seed;
    },
    setSeed(value: number, running: boolean) {
      const next = clampSeed(value);
      if (running) pending = [...pending.filter((p) => p.kind !== "seed"), { kind: "seed", seed: next }];
      else seed = next;
    },
    /** 播放中改条件：暂存到下一圈边界；停止时直接生效。condition 为 null 表示移除条件。 */
    stageCondition(trackId: string, noteId: string, condition: NoteCondition | null, running: boolean) {
      const track = findTrack(trackId);
      const note = track?.notes.find((n) => n.id === noteId);
      if (!track || !note) throw new Error("目标音符已不存在，条件未应用");
      const candidate: Track = {
        ...track,
        notes: track.notes.map((n) => {
          if (n.id !== noteId) return n;
          if (condition === null) {
            const { condition: _drop, ...rest } = n;
            return rest;
          }
          return { ...n, condition };
        }),
      };
      const error = validateConditions(candidate);
      if (error) throw new Error(error);
      if (!running) {
        tracks = tracks.map((t) => (t.id === trackId ? candidate : t));
        return;
      }
      pending = [
        ...pending.filter(
          (p) => !(p.kind === "condition" && p.noteId === noteId),
        ),
        { kind: "condition", trackId, noteId, condition },
      ];
    },
    /** 把某一圈实际听到的内容烘焙为固定音符（移除未触发音符与全部条件）。 */
    stageBake(trackId: string, loopIndex: number, running: boolean) {
      const track = findTrack(trackId);
      if (!track) throw new Error("目标轨道已不存在");
      if (!running) {
        this.commit(trackId, bakeLoop(track, seed, loopIndex));
        return;
      }
      pending = [
        ...pending.filter((p) => !(p.kind === "bake" && p.trackId === trackId)),
        { kind: "bake", trackId, loopIndex },
      ];
    },
    hasPending() {
      return pending.length > 0;
    },
    /** 在循环边界调用：把暂存修改整体落库，之后新一圈才按新条件编排与发声。 */
    flushPending() {
      if (!pending.length) return 0;
      for (const p of pending) {
        if (p.kind === "seed") {
          seed = p.seed;
        } else if (p.kind === "condition") {
          const track = findTrack(p.trackId);
          if (!track) continue;
          const candidate: Track = {
            ...track,
            notes: track.notes.map((n) => {
              if (n.id !== p.noteId) return n;
              if (p.condition === null) {
                const { condition: _drop, ...rest } = n;
                return rest;
              }
              return { ...n, condition: p.condition };
            }),
          };
          if (validateConditions(candidate) === null)
            tracks = tracks.map((t) => (t.id === p.trackId ? candidate : t));
        } else {
          const track = findTrack(p.trackId);
          if (track) this.commit(p.trackId, bakeLoop(track, seed, p.loopIndex));
        }
      }
      const count = pending.length;
      pending = [];
      if (!noteTrack(selectedNote ?? "")) selectedNote = null;
      return count;
    },
    /** 停止（从头重播）时丢弃未生效的暂存，避免与已预排声音/高亮不一致。 */
    discardPending() {
      pending = [];
    },
  };
}
export type Arrangement = ReturnType<typeof createArrangement>;
