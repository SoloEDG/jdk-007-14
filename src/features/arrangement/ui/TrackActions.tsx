import type { Instrument, Track } from "@/shared/types";
import { hasCondition } from "@/features/conditions";
export function TrackActions({
  selected,
  count,
  locked,
  running,
  previewLoop,
  add,
  remove,
  clear,
  bake,
}: {
  selected: Track | null;
  count: number;
  locked: boolean;
  running: boolean;
  previewLoop: number;
  add: (kind: Instrument) => void;
  remove: () => void;
  clear: () => void;
  bake: (loopIndex: number) => void;
}) {
  const canBake = !!selected && selected.notes.some((n) => hasCondition(n));
  return (
    <div className="track-actions">
      <button disabled={locked || count >= 8} onClick={() => add("drums")}>
        ＋ 鼓组轨道
      </button>
      <button disabled={locked || count >= 8} onClick={() => add("keys")}>
        ＋ 琴键轨道
      </button>
      <span>{count} / 8 轨道</span>
      <button
        disabled={locked || !canBake}
        onClick={() => bake(previewLoop)}
        title="把当前预览圈实际听到的音符固定为确定音符，移除全部条件"
      >
        烘焙第 {previewLoop} 圈
      </button>
      <button
        disabled={locked || !selected || !selected.notes.length}
        onClick={clear}
      >
        清空音符
      </button>
      <button
        disabled={locked || !selected}
        onClick={remove}
        aria-label="删除选中轨道"
      >
        删除轨道
      </button>
    </div>
  );
}
