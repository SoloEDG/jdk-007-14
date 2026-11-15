import type { Track, Note } from "@/shared/types";
import { evaluateTrack, hasCondition } from "@/features/conditions";
export function Timeline({
  tracks,
  selected,
  selectedNote,
  position,
  beats,
  draft,
  seed,
  previewLoop,
  select,
  selectNote,
}: {
  tracks: readonly Track[];
  selected: string | null;
  selectedNote: string | null;
  position: number;
  beats: number;
  draft: readonly Note[];
  seed: number;
  previewLoop: number;
  select: (id: string) => void;
  selectNote: (id: string | null) => void;
}) {
  return (
    <div className="timeline-scroll">
      <div className="timeline" style={{ minWidth: 500 }}>
        <div className="ruler">
          <span>轨道 / TRACK</span>
          <div>
            {Array.from({ length: beats / 4 }, (_, i) => (
              <b key={i}>{String(i + 1).padStart(2, "0")}</b>
            ))}
          </div>
        </div>
        {tracks.map((track, i) => {
          // 与调度器完全相同的纯函数：时间轴所见即本圈所奏
          const fires = evaluateTrack(track, seed, previewLoop);
          return (
            <div
              className={`lane ${selected === track.id ? "selected" : ""}`}
              key={track.id}
            >
              <button className="lane-name" onClick={() => select(track.id)}>
                <span style={{ color: track.color }}>0{i + 1}</span>
                <strong>{track.name}</strong>
                <small>
                  {track.instrument === "drums" ? "DRUM MACHINE" : "POLY SYNTH"}
                </small>
              </button>
              <div
                className="lane-notes"
                style={{ "--bars": beats / 4 } as React.CSSProperties}
              >
                {[...track.notes, ...(selected === track.id ? draft : [])].map(
                  (n) => {
                    const isDraft = draft.includes(n);
                    const muted =
                      !isDraft && hasCondition(n) && fires.get(n.id) !== true;
                    return (
                      <button
                        className={`note-block ${isDraft ? "draft" : ""} ${muted ? "muted" : ""} ${selectedNote === n.id ? "picked" : ""} ${hasCondition(n) ? "conditional" : ""}`}
                        key={n.id}
                        title={
                          hasCondition(n)
                            ? muted
                              ? `第 ${previewLoop} 圈不触发`
                              : `第 ${previewLoop} 圈触发（条件音符）`
                            : "必定触发"
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          select(track.id);
                          selectNote(isDraft ? null : n.id);
                        }}
                        style={{
                          left: `${(n.beat / beats) * 100}%`,
                          width: `${Math.max(0.6, (Math.min(n.duration, beats - n.beat) / beats) * 100)}%`,
                          top: `${12 + (track.instrument === "drums" ? n.pitch : (((72 - n.pitch) % 12) + 12) % 12) * 3}%`,
                          background: track.color,
                        }}
                      />
                    );
                  },
                )}
                <i
                  className="playhead"
                  style={{ left: `${(position / beats) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
        {tracks.length === 0 && (
          <div className="empty-arrangement">
            <span>♫</span>
            <h3>第一拍，从你开始</h3>
            <p>添加鼓组或琴键轨道，录下属于你的循环。</p>
          </div>
        )}
      </div>
    </div>
  );
}
