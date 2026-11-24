import {
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { CameraPreset, QuantumMode, SimulationParams } from '../physics/quantumGravityMath';

interface ControlDockProps {
  mode: QuantumMode;
  params: SimulationParams;
  onChangeParams: (patch: Partial<SimulationParams>) => void;
  isPaused: boolean;
  onTogglePause: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onTriggerExperiment: () => void;
  onSelectCamera: (preset: CameraPreset) => void;
  onResetParams: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function ControlDock({
  mode,
  params,
  onChangeParams,
  isPaused,
  onTogglePause,
  soundEnabled,
  onToggleSound,
  onTriggerExperiment,
  onSelectCamera,
  onResetParams,
  collapsed,
  onToggleCollapsed,
}: ControlDockProps) {
  const experimentLabel =
    mode === 'spacetime' ? '광자 발사' : mode === 'lqg' ? '빅 바운스' : '얽힘 쌍 생성';

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 w-[min(920px,94vw)] flex flex-col items-center pointer-events-none"
      role="region"
      aria-label="시뮬레이션 제어 패널"
    >
      {/* Collapsible Drawer Handle */}
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="pointer-events-auto mb-1.5 flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium text-slate-300 bg-[#0b1120]/95 border border-slate-700/75 rounded-md hover:text-white hover:border-slate-500 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
      >
        {collapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        <span>{collapsed ? '컨트롤 열기 (H)' : '컨트롤 숨기기 (H)'}</span>
      </button>

      {/* Main Unified Control Surface (solid/translucent obsidian, zero backdrop-filter over WebGL) */}
      <div
        className={`pointer-events-auto w-full bg-[#0a101d]/94 border border-slate-700/70 rounded-xl px-4 py-3.5 md:px-5 md:py-4 transition-transform duration-200 ease-out ${
          collapsed ? 'translate-y-[125%] opacity-0 pointer-events-none h-0 py-0 border-0 overflow-hidden' : 'translate-y-0 opacity-100'
        }`}
      >
        <div className="flex flex-col gap-3.5">
          {/* Top Row: Mode-Specific Calibrated Sliders */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {mode === 'spacetime' && (
              <>
                <label className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">관측 스케일 log₁₀(L/ℓ_P)</span>
                    <span className="font-mono tabular-nums text-cyan-300">
                      10^{params.scaleLogPlanck.toFixed(1)} ℓ_P
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    step={0.1}
                    value={params.scaleLogPlanck}
                    onChange={(e) => onChangeParams({ scaleLogPlanck: parseFloat(e.target.value) })}
                    className="lab-slider"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>플랑크 거품 (1 ℓ_P)</span>
                    <span>매끄러운 일반상대론</span>
                  </div>
                </label>

                <label className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">중심 질량 에너지 (M)</span>
                    <span className="font-mono tabular-nums text-amber-300">
                      {(params.massEnergy * 2.5).toFixed(2)} m_P
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.25}
                    max={2.4}
                    step={0.05}
                    value={params.massEnergy}
                    onChange={(e) => onChangeParams({ massEnergy: parseFloat(e.target.value) })}
                    className="lab-slider"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>약한 곡률</span>
                    <span>강한 사건의 지평선</span>
                  </div>
                </label>

                <label className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">양자 요동 결합 (ℏ)</span>
                    <span className="font-mono tabular-nums text-slate-200">
                      {(params.quantumFluctuation * 100).toFixed(0)} %
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1.5}
                    step={0.05}
                    value={params.quantumFluctuation}
                    onChange={(e) => onChangeParams({ quantumFluctuation: parseFloat(e.target.value) })}
                    className="lab-slider"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>고전 극한</span>
                    <span>극단적 시공 요동</span>
                  </div>
                </label>
              </>
            )}

            {mode === 'lqg' && (
              <>
                <label className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">바르베로-이미르지 상수 (γ)</span>
                    <span className="font-mono tabular-nums text-cyan-300">
                      {params.immirziGamma.toFixed(4)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.12}
                    max={0.45}
                    step={0.0025}
                    value={params.immirziGamma}
                    onChange={(e) => onChangeParams({ immirziGamma: parseFloat(e.target.value) })}
                    className="lab-slider"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>0.120</span>
                    <span>표준 ≈ 0.2375</span>
                    <span>0.450</span>
                  </div>
                </label>

                <label className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">양자 진동 여기 강도</span>
                    <span className="font-mono tabular-nums text-amber-300">
                      {(params.spinExcitation * 100).toFixed(0)} %
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={1.4}
                    step={0.05}
                    value={params.spinExcitation}
                    onChange={(e) => onChangeParams({ spinExcitation: parseFloat(e.target.value) })}
                    className="lab-slider"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>바닥 상태</span>
                    <span>고에너지 스핀 진동</span>
                  </div>
                </label>

                <div className="flex flex-col justify-center gap-1.5 border-t md:border-t-0 md:border-l border-slate-800/80 pt-2 md:pt-0 md:pl-5">
                  <span className="text-xs font-medium text-slate-300">SU(2) 스핀 양자수 범례</span>
                  <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums text-slate-400">
                    <span className="text-blue-400">1/2</span>
                    <span className="text-cyan-400">1</span>
                    <span className="text-emerald-400">3/2</span>
                    <span className="text-amber-400">2</span>
                    <span className="text-rose-400">5/2</span>
                  </div>
                </div>
              </>
            )}

            {mode === 'holography' && (
              <>
                <label className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">경계 양자 얽힘 밀도</span>
                    <span className="font-mono tabular-nums text-cyan-300">
                      {(params.entanglementDensity * 100).toFixed(0)} %
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={1.0}
                    step={0.05}
                    value={params.entanglementDensity}
                    onChange={(e) => onChangeParams({ entanglementDensity: parseFloat(e.target.value) })}
                    className="lab-slider"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>희박한 얽힘</span>
                    <span>고밀도 시공 창발</span>
                  </div>
                </label>

                <label className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">벌크 블랙홀 지평선 반경</span>
                    <span className="font-mono tabular-nums text-amber-300">
                      {(params.bulkHorizonRadius * 100).toFixed(0)} % R
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={0.6}
                    step={0.02}
                    value={params.bulkHorizonRadius}
                    onChange={(e) => onChangeParams({ bulkHorizonRadius: parseFloat(e.target.value) })}
                    className="lab-slider"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>순수 AdS 진공</span>
                    <span>열적 블랙홀 지평선</span>
                  </div>
                </label>

                <div className="flex flex-col justify-center gap-1 border-t md:border-t-0 md:border-l border-slate-800/80 pt-2 md:pt-0 md:pl-5">
                  <span className="text-xs font-medium text-slate-300">최소 곡면 원리</span>
                  <span className="text-[11px] font-mono text-slate-400">
                    S_A = Area(γ_A) / 4G_Nℏ
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Bottom Row: Experiment Trigger, Playback, Audio & Camera Presets */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-slate-800/80">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onTriggerExperiment}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{experimentLabel}</span>
              </button>

              <button
                type="button"
                onClick={onTogglePause}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-900 border border-slate-700/80 hover:border-slate-500 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                <span>{isPaused ? '재생' : '일시정지'}</span>
              </button>

              <button
                type="button"
                onClick={onToggleSound}
                aria-label={soundEnabled ? '음향 끄기' : '음향 켜기'}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                  soundEnabled
                    ? 'bg-cyan-500/15 text-cyan-200 border-cyan-500/45'
                    : 'bg-slate-900 text-slate-400 border-slate-700/80 hover:text-slate-200'
                }`}
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{soundEnabled ? '음향 켬' : '음향 끔'}</span>
              </button>

              <button
                type="button"
                onClick={onResetParams}
                aria-label="매개변수 초기화"
                className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium text-slate-400 hover:text-slate-100 bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">초기화</span>
              </button>
            </div>

            {/* Camera Viewpoint Presets */}
            <div className="flex items-center gap-1 bg-slate-900/95 p-1 rounded-md border border-slate-800">
              {(
                [
                  { id: 'default', label: '기본 시점' },
                  { id: 'top', label: '상단 투영' },
                  { id: 'closeup', label: '근접 관측' },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSelectCamera(preset.id)}
                  className="px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
