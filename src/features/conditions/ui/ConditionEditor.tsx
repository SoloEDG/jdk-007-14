import { useEffect, useState } from "react";
import type { Note, NoteCondition, Track } from "@/shared/types";
import { defaultCondition } from "../model/gate";
export function ConditionEditor({
  track,
  note,
  running,
  locked,
  onApply,
}: {
  track: Track | null;
  note: Note | null;
  running: boolean;
  locked: boolean;
  onApply: (noteId: string, condition: NoteCondition | null) => void;
}) {
  const [draft, setDraft] = useState<NoteCondition>(defaultCondition());
  const [enabled, setEnabled] = useState(false);
  // 只依赖原始字段：view() 每 20ms 会结构化克隆出新对象，
  // 若依赖 condition 对象引用会在编辑过程中反复重置草稿
  useEffect(() => {
    if (note) {
      setDraft(note.condition ? { ...note.condition } : defaultCondition());
      setEnabled(note.condition !== undefined);
    }
  }, [
    note?.id,
    note?.condition?.probability,
    note?.condition?.every,
    note?.condition?.phase,
    note?.condition?.prerequisiteId,
  ]);
  if (!note || !track)
    return (
      <div className="condition-editor empty">
        <span>在时间轴上点选一个音符，为它设置出现概率、循环间隔或前置依赖；未设置条件的音符每圈必定触发。</span>
      </div>
    );
  const candidates = track.notes
    .filter((n) => n.id !== note.id && n.beat < note.beat)
    .sort((a, b) => a.beat - b.beat);
  const submit = () => {
    // 关闭开关即彻底移除条件，音符回到“每圈必定触发”的旧音符形态
    onApply(note.id, enabled ? draft : null);
  };
  const label = (n: Note) =>
    `${track.instrument === "drums" ? `鼓${n.pitch}` : `音高${n.pitch}`} · 拍 ${n.beat % 1 ? n.beat.toFixed(2) : n.beat}`;
  return (
    <div className="condition-editor">
      <div className="condition-head">
        <strong>触发条件</strong>
        <label className="switch">
          <input
            type="checkbox"
            checked={enabled}
            disabled={locked}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span>{enabled ? "条件触发" : "必定触发（旧音符默认）"}</span>
        </label>
      </div>
      <fieldset disabled={!enabled || locked} className="condition-fields">
        <label>
          出现概率
          <span className="range-row">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={draft.probability}
              onChange={(e) =>
                setDraft({ ...draft, probability: Number(e.target.value) })
              }
            />
            <b>{Math.round(draft.probability * 100)}%</b>
          </span>
        </label>
        <label>
          每几圈触发
          <input
            type="number"
            min={1}
            max={64}
            value={draft.every}
            onChange={(e) => {
              const every = Math.max(1, Math.min(64, Math.floor(Number(e.target.value) || 1)));
              setDraft({
                ...draft,
                every,
                phase: Math.min(draft.phase, every - 1),
              });
            }}
          />
        </label>
        <label>
          起始相位（第几圈开始）
          <input
            type="number"
            min={0}
            max={Math.max(0, draft.every - 1)}
            value={draft.phase}
            onChange={(e) =>
              setDraft({
                ...draft,
                phase: Math.max(0, Math.min(draft.every - 1, Math.floor(Number(e.target.value) || 0))),
              })
            }
          />
        </label>
        <label>
          前置音符（前一步成功才触发）
          <select
            value={draft.prerequisiteId ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, prerequisiteId: e.target.value || null })
            }
          >
            <option value="">无</option>
            {candidates.map((n) => (
              <option key={n.id} value={n.id}>
                {label(n)}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      <div className="condition-actions">
        <button type="button" disabled={locked} onClick={submit}>
          {running ? "暂存，下一圈生效" : "应用条件"}
        </button>
        {running && (
          <span className="hint">播放中修改不会扰动当前圈已预排的声音与高亮</span>
        )}
      </div>
    </div>
  );
}
