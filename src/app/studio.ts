import { createEngine, bindPerformanceInput } from "@/features/instruments";
import { createTransport, createSchedulePlanner } from "@/features/transport";
import { createRecorder, type RecordMode } from "@/features/recorder";
import {
  createArrangement,
  demoSession,
  saveSession,
  loadSession,
} from "@/features/arrangement";
import {
  randomSeed,
  clampSeed,
} from "@/features/conditions";
import type { NoteCondition } from "@/shared/types";
import { createMixer } from "@/features/mixer";
import type { NoteInput, Instrument, Session } from "@/shared/types";
export function createStudio(notify: () => void) {
  const engine = createEngine(),
    transport = createTransport(),
    recorder = createRecorder(),
    arrangement = createArrangement(),
    mixer = createMixer();
  const active = new Set<string>();
  let message = "欢迎来到夜航。戴上耳机，试着敲下第一拍。",
    epoch = 0,
    disposed = false,
    planner = createSchedulePlanner(arrangement.getSeed()),
    lastLoopIndex = 0,
    previewLoop = 0;
  const now = () => engine.context?.currentTime ?? 0;
  const feedback = (text: string) => {
    message = text;
    notify();
  };
  const guard = (fn: () => void) => {
    try {
      fn();
      notify();
    } catch (error) {
      feedback(
        error instanceof Error ? error.message : "操作失败，现有作品已保留",
      );
    }
  };
  const syncMixer = () =>
    mixer.ensure(arrangement.snapshot().tracks.map((t) => t.id));
  const cancelVoices = () => {
    engine.cancel();
    active.clear();
  };
  // 种子变化（包括边界 flush 落库）后重建规划器；门控纯函数保证可复现
  const syncPlanner = () => {
    if (planner.seed !== arrangement.getSeed())
      planner = createSchedulePlanner(arrangement.getSeed());
  };
  const stop = () => {
    epoch++;
    transport.stop();
    recorder.cancel();
    cancelVoices();
    arrangement.discardPending();
    lastLoopIndex = 0;
    previewLoop = 0;
    syncPlanner();
    notify();
  };
  const pause = () => {
    epoch++;
    // 暂停只冻结时钟：已过步骤的判定来自纯函数，继续时不会重新抽取
    transport.pause(now());
    recorder.cancel();
    cancelVoices();
    feedback("播放已暂停；未完成录音已取消，原片段保留。");
  };
  const unlock = async () => {
    const context = await engine.unlock();
    if (disposed) return false;
    mixer.attach(context);
    syncMixer();
    engine.route(mixer.channel);
    return true;
  };
  const play = async () => {
    const token = ++epoch;
    try {
      if (!(await unlock()) || token !== epoch) return;
      transport.start(now() + 0.02);
      lastLoopIndex = transport.view(now()).loopIndex;
      tick();
      notify();
    } catch {
      feedback("声音启动失败，请再次点击播放");
    }
  };
  const commitTake = (
    take: { trackId: string; notes: Parameters<typeof arrangement.commit>[1]; mode: RecordMode },
  ) =>
    guard(() => {
      const mode = arrangement.commitTake(take.trackId, take.notes, take.mode);
      syncPlanner();
      message =
        mode === "bake"
          ? `录制完成 · 已烘焙为 ${take.notes.length} 个确定音符（无条件）`
          : `录制完成 · ${take.notes.length} 个新音符并入，条件继续演化`;
    });
  const tick = () => {
    const time = now(),
      view = transport.view(time);
    const take = recorder.advance(view.absolute);
    if (take) commitTake(take);
    // 跨圈边界：先把暂存修改整体落库，再排新一圈，避免声音与高亮不一致
    if (view.running && view.loopIndex !== lastLoopIndex) {
      if (arrangement.hasPending()) {
        const count = arrangement.flushPending();
        syncPlanner();
        feedback(`已到第 ${view.loopIndex} 圈边界，${count} 项修改开始生效。`);
      }
      lastLoopIndex = view.loopIndex;
      if (previewLoop < view.loopIndex) previewLoop = view.loopIndex;
    }
    const capture = recorder.snapshot();
    const ceiling =
      capture.status === "idle" ? Infinity : capture.start + capture.length;
    const window = transport.window(time, ceiling);
    if (window)
      planner.scheduleWindow(
        arrangement.forPlayback(),
        window.from,
        window.to,
        view.beats,
        view.bpm,
        window.timeAt,
        (n) => engine.play(n),
      );
  };
  const down = async (id: string, note: NoteInput) => {
    if (active.has(id)) return;
    active.add(id);
    notify();
    try {
      if (!(await unlock()) || !active.has(id)) return;
      const target = arrangement.selected();
      if (!target || target.instrument !== note.instrument) {
        active.delete(id);
        feedback("请先选择对应乐器的轨道");
        return;
      }
      const abs = transport.view(now()).absolute;
      const take = recorder.advance(abs);
      if (take) commitTake(take);
      recorder.down(id, note, abs);
      engine.play(
        {
          ...note,
          trackId: target.id,
          duration: note.instrument === "keys" ? 6 : 0.3,
          when: now(),
        },
        id,
      );
    } catch {
      active.delete(id);
      feedback("请点击播放以启用声音");
    }
  };
  const up = (id: string) => {
    if (!active.delete(id)) return;
    recorder.up(id, transport.view(now()).absolute);
    engine.release(id);
    notify();
  };
  const install = (session: Session) => {
    stop();
    const valid = arrangement.restore(session);
    transport.configure(valid.bpm, valid.beats);
    mixer.restore(valid.channels, valid.master);
    syncPlanner();
    previewLoop = 0;
    notify();
  };
  const timer = window.setInterval(() => {
    tick();
    notify();
  }, 20);
  const unbind = bindPerformanceInput((id, note) => void down(id, note), up);
  const shortcut = (e: KeyboardEvent) => {
    if (
      e.code === "Space" &&
      !e.repeat &&
      !/INPUT|TEXTAREA|SELECT|BUTTON/.test((e.target as HTMLElement).tagName)
    ) {
      e.preventDefault();
      if (transport.view(now()).running) pause();
      else void play();
    }
  };
  const blur = () => {
    for (const id of [...active]) up(id);
  };
  window.addEventListener("keydown", shortcut);
  window.addEventListener("blur", blur);
  return {
    view() {
      return {
        transport: transport.view(now()),
        arrangement: arrangement.snapshot(),
        selected: arrangement.selected(),
        recorder: recorder.snapshot(),
        mixer: mixer.snapshot(),
        active: new Set(active),
        previewLoop,
        message,
      };
    },
    play,
    pause,
    stop,
    down: (id: string, n: NoteInput) => void down(id, n),
    up,
    configure(bpm: number, beats: number) {
      stop();
      transport.configure(bpm, beats);
      arrangement.resizeLoop(transport.view(now()).beats);
      feedback("速度或长度变更：播放回到起点；缩短时移除范围外音符。");
    },
    add(kind: Instrument) {
      guard(() => {
        arrangement.add(kind);
        syncMixer();
      });
    },
    select(id: string) {
      if (recorder.snapshot().status !== "idle") return;
      engine.releaseHeld();
      active.clear();
      arrangement.select(id);
      notify();
    },
    selectNote(id: string | null) {
      arrangement.selectNote(id);
      notify();
    },
    remove() {
      guard(() => {
        const selected = arrangement.selected();
        if (selected) {
          stop();
          arrangement.remove(selected.id);
          syncMixer();
        }
      });
    },
    clear() {
      guard(() => {
        const t = arrangement.selected();
        if (t) {
          stop();
          arrangement.clear(t.id);
        }
      });
    },
    setSeed(value: number) {
      guard(() => {
        const running = transport.view(now()).running;
        arrangement.setSeed(clampSeed(value), running);
        if (!running) syncPlanner();
        feedback(
          running
            ? "种子已暂存，将在下一圈起点生效"
            : "种子已更新，同一种子下各圈结果可复现",
        );
      });
    },
    reseed() {
      this.setSeed(randomSeed());
    },
    setPreviewLoop(n: number) {
      previewLoop = Math.max(0, Math.floor(n));
      notify();
    },
    applyCondition(noteId: string, condition: NoteCondition | null) {
      guard(() => {
        const t = arrangement.selected();
        if (!t) throw new Error("请先选择轨道");
        const running = transport.view(now()).running;
        arrangement.stageCondition(t.id, noteId, condition, running);
        feedback(
          running
            ? "条件已暂存，下一圈起点统一生效，当前圈不变"
            : "条件已应用；编排即时反映本圈实际演奏",
        );
      });
    },
    bake(loopIndex: number) {
      guard(() => {
        const t = arrangement.selected();
        if (!t) throw new Error("请先选择轨道");
        const running = transport.view(now()).running;
        arrangement.stageBake(t.id, loopIndex, running);
        if (!running) syncPlanner();
        feedback(
          running
            ? `烘焙已暂存，将在圈边界把第 ${loopIndex} 圈固定为确定音符`
            : `第 ${loopIndex} 圈已烘焙为确定音符并保存，条件已移除`,
        );
      });
    },
    setRecordMode(mode: RecordMode) {
      recorder.setMode(mode);
      notify();
    },
    async record() {
      const selected = arrangement.selected();
      if (!selected) return;
      const token = ++epoch;
      try {
        if (!(await unlock()) || token !== epoch) return;
        const state = transport.view(now());
        if (!state.running) transport.start(now() + 0.02);
        lastLoopIndex = transport.view(now()).loopIndex;
        recorder.arm(
          selected.id,
          selected.instrument,
          transport.view(now()).absolute,
          state.beats,
          recorder.snapshot().mode,
        );
        tick();
        notify();
      } catch {
        feedback("录音启动失败，请重试");
      }
    },
    cancel() {
      recorder.cancel();
      feedback("本次录音已取消，之前的片段仍然保留。");
    },
    grid(n: number) {
      recorder.grid(n);
      notify();
    },
    volume(id: string, n: number) {
      mixer.volume(id, n);
      notify();
    },
    mute(id: string) {
      mixer.mute(id);
      notify();
    },
    master(n: number) {
      mixer.master(n);
      notify();
    },
    demo() {
      guard(() => {
        install(demoSession());
        message = "示范已载入 · 点击播放，听听凌晨两点。";
      });
    },
    save() {
      guard(() => {
        if (recorder.snapshot().status !== "idle")
          throw new Error("请完成或取消录音后再保存");
        const a = arrangement.snapshot(),
          t = transport.view(now()),
          m = mixer.snapshot();
        // 烘焙模式的轨道不含 condition；演化模式保留 condition，二者在存档中清楚区分
        const session: Session = {
          version: 2,
          title: a.title,
          bpm: t.bpm,
          beats: t.beats,
          seed: a.seed,
          tracks: a.tracks,
          channels: m.channels,
          master: m.master,
        };
        saveSession(session);
        message = "作品已保存到本机浏览器（含种子与触发条件）";
      });
    },
    load() {
      guard(() => {
        const session = loadSession();
        install(session);
        message = "本地作品已恢复";
      });
    },
    dispose() {
      disposed = true;
      epoch++;
      clearInterval(timer);
      unbind();
      window.removeEventListener("keydown", shortcut);
      window.removeEventListener("blur", blur);
      mixer.dispose();
      engine.dispose();
    },
  };
}
export type Studio = ReturnType<typeof createStudio>;
