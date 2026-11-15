import type { Recorder, RecordMode } from "../model/recorder";
export function RecordControls({
  state,
  canRecord,
  record,
  cancel,
  setGrid,
  setMode,
}: {
  state: ReturnType<Recorder["snapshot"]>;
  canRecord: boolean;
  record: () => void;
  cancel: () => void;
  setGrid: (n: number) => void;
  setMode: (m: RecordMode) => void;
}) {
  const idle = state.status === "idle";
  return (
    <div className="record-controls">
      <button
        className={`record ${!idle ? "recording" : ""}`}
        disabled={!canRecord && idle}
        onClick={idle ? record : cancel}
      >
        <span />
        {idle ? "录制循环" : "取消本次录制"}
      </button>
      <label>
        吸附
        <select
          aria-label="录音吸附"
          value={state.grid}
          disabled={!idle}
          onChange={(e) => setGrid(Number(e.target.value))}
        >
          <option value="0.25">1/16 音符</option>
          <option value="0.5">1/8 音符</option>
          <option value="1">1/4 音符</option>
        </select>
      </label>
      <fieldset className="record-mode" disabled={!idle}>
        <legend>提交方式</legend>
        <label className={state.mode === "bake" ? "on" : ""}>
          <input
            type="radio"
            name="record-mode"
            checked={state.mode === "bake"}
            onChange={() => setMode("bake")}
          />
          <span>
            烘焙固定
            <small>本圈听到的音符存为确定音符，清除条件</small>
          </span>
        </label>
        <label className={state.mode === "evolve" ? "on" : ""}>
          <input
            type="radio"
            name="record-mode"
            checked={state.mode === "evolve"}
            onChange={() => setMode("evolve")}
          />
          <span>
            保留演化
            <small>新录音符并入，轨道条件保留并继续逐圈变化</small>
          </span>
        </label>
      </fieldset>
    </div>
  );
}
