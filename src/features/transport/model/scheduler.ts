import type { Track, ScheduledNote } from "@/shared/types";
import { occurrences } from "../lib/timing";
import { evaluateTrack } from "@/features/conditions";
type CacheKey = string;
/**
 * 门控结果缓存：同一 (轨道, 种子, 圈) 只 evaluate 一次。
 * 时间轴预览直接调用同一个纯函数 evaluateTrack，因此预览与发声永远一致，
 * 不会出现“预览抽一次、调度再抽一次”的两套随机数。
 */
export function createSchedulePlanner(seed: number) {
  const cache = new Map<CacheKey, Map<string, boolean>>();
  const loopOf = (beat: number, length: number) => Math.floor(beat / length);
  const fires = (track: Track, loopIndex: number) => {
    const key = `${track.id}:${seed}:${loopIndex}`;
    let map = cache.get(key);
    if (!map) {
      map = evaluateTrack(track, seed, loopIndex);
      cache.set(key, map);
    }
    return map;
  };
  return {
    seed,
    scheduleWindow(
      tracks: readonly Track[],
      from: number,
      to: number,
      beats: number,
      bpm: number,
      timeAt: (beat: number) => number,
      play: (note: ScheduledNote) => void,
    ) {
      for (const track of tracks)
        for (const note of track.notes)
          for (const beat of occurrences(note.beat, from, to, beats)) {
            if (fires(track, loopOf(beat, beats)).get(note.id) !== true)
              continue;
            play({
              trackId: track.id,
              instrument: track.instrument,
              pitch: note.pitch,
              velocity: note.velocity,
              duration: (note.duration * 60) / bpm,
              when: timeAt(beat),
            });
          }
    },
  };
}
export type SchedulePlanner = ReturnType<typeof createSchedulePlanner>;
