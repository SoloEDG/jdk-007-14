import { clampSeed } from "../model/rng";
export function LoopPreview({
  loopIndex,
  previewLoop,
  onPreviewLoop,
  seed,
  running,
  pendingCount,
  onSeed,
  onReseed,
  locked,
}: {
  loopIndex: number;
  previewLoop: number;
  onPreviewLoop: (n: number) => void;
  seed: number;
  running: boolean;
  pendingCount: number;
  onSeed: (n: number) => void;
  onReseed: () => void;
  locked: boolean;
}) {
  return (
    <div className="loop-preview">
      <div className="loop-preview-group">
        <span className="loop-preview-label">预览圈</span>
        <button
          type="button"
          className="mini"
          aria-label="上一圈"
          disabled={previewLoop <= 0}
          onClick={() => onPreviewLoop(Math.max(0, previewLoop - 1))}
        >
          ‹
        </button>
        <input
          aria-label="预览圈序号"
          className="loop-number"
          type="number"
          min={0}
          max={9999}
          value={previewLoop}
          onChange={(e) =>
            onPreviewLoop(Math.max(0, Math.floor(Number(e.target.value) || 0)))
          }
        />
        <button
          type="button"
          className="mini"
          aria-label="下一圈"
          onClick={() => onPreviewLoop(previewLoop + 1)}
        >
          ›
        </button>
        <button
          type="button"
          className="mini"
          onClick={() => onPreviewLoop(loopIndex)}
          title="回到当前播放圈"
        >
          当前
        </button>
        <span className="loop-current">
          播放中：第 <b>{loopIndex}</b> 圈
        </span>
      </div>
      <div className="loop-preview-group">
        <label className="seed-field">
          种子
          <input
            aria-label="随机种子"
            type="number"
            min={0}
            max={4294967295}
            value={seed}
            disabled={locked}
            onChange={(e) => onSeed(clampSeed(Number(e.target.value)))}
          />
        </label>
        <button
          type="button"
          className="mini"
          disabled={locked}
          onClick={onReseed}
          title="换一个可保存的种子"
        >
          换种子
        </button>
        {running && pendingCount > 0 && (
          <span className="pending-badge" role="status">
            {pendingCount} 项修改将在第 {loopIndex + 1} 圈起点生效
          </span>
        )}
      </div>
    </div>
  );
}
