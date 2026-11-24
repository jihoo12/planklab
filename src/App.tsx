import { useCallback, useEffect, useRef, useState } from 'react';
import { ControlDock } from './components/ControlDock';
import { PhysicsReadout } from './components/PhysicsReadout';
import { TheoryDrawer } from './components/TheoryDrawer';
import { TopBar } from './components/TopBar';
import {
  CameraPreset,
  PhysicsMetrics,
  QuantumAudioFeedback,
  QuantumMode,
  SimulationParams,
  computeHolographyMetrics,
  computeLqgMetrics,
  computeSpacetimeMetrics,
} from './physics/quantumGravityMath';
import { QuantumGravityEngine } from './scene/QuantumGravityEngine';

const DEFAULT_PARAMS: SimulationParams = {
  scaleLogPlanck: 1.2,
  massEnergy: 1.15,
  quantumFluctuation: 0.9,
  immirziGamma: 0.2375,
  spinExcitation: 0.55,
  entanglementDensity: 0.65,
  bulkHorizonRadius: 0.26,
};

function createInitialMetrics(params: SimulationParams): PhysicsMetrics {
  return {
    ...computeSpacetimeMetrics(params, 2),
    ...computeLqgMetrics([0.5, 1, 1.5], 48, params.immirziGamma, 'equilibrium'),
    ...computeHolographyMetrics(params, 24, 120),
  };
}

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<QuantumGravityEngine | null>(null);
  const audioRef = useRef<QuantumAudioFeedback | null>(null);
  const noteTimeoutRef = useRef<number | null>(null);

  const [mode, setMode] = useState<QuantumMode>('spacetime');
  const [params, setParams] = useState<SimulationParams>(DEFAULT_PARAMS);
  const [metrics, setMetrics] = useState<PhysicsMetrics>(() => createInitialMetrics(DEFAULT_PARAMS));
  const [isPaused, setIsPaused] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [theoryOpen, setTheoryOpen] = useState(false);
  const [interactionNote, setInteractionNote] = useState<string | null>(null);
  const [contextLost, setContextLost] = useState(false);

  const showTransientNote = useCallback((note: string) => {
    setInteractionNote(note);
    if (noteTimeoutRef.current) {
      window.clearTimeout(noteTimeoutRef.current);
    }
    noteTimeoutRef.current = window.setTimeout(() => {
      setInteractionNote(null);
    }, 3600);
  }, []);

  // Initialize Three.js WebGL engine once inside isolated mountRef
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const audio = new QuantumAudioFeedback();
    audioRef.current = audio;

    const engine = new QuantumGravityEngine(
      container,
      DEFAULT_PARAMS,
      {
        onMetricsUpdate: (nextMetrics) => setMetrics(nextMetrics),
        onInteractionNote: showTransientNote,
        onContextLost: (lost) => setContextLost(lost),
      },
      audio,
    );
    engineRef.current = engine;

    return () => {
      if (noteTimeoutRef.current) {
        window.clearTimeout(noteTimeoutRef.current);
      }
      engine.dispose();
      engineRef.current = null;
      audio.dispose();
      audioRef.current = null;
    };
  }, [showTransientNote]);

  // Sync mode changes to engine
  const handleModeChange = useCallback((nextMode: QuantumMode) => {
    setMode(nextMode);
    setInteractionNote(null);
    engineRef.current?.setMode(nextMode);
  }, []);

  // Sync parameter patches to engine
  const handleChangeParams = useCallback((patch: Partial<SimulationParams>) => {
    setParams((prev) => {
      const next = { ...prev, ...patch };
      engineRef.current?.updateParams(next);
      return next;
    });
  }, []);

  const handleTogglePause = useCallback(() => {
    setIsPaused((prev) => {
      const next = !prev;
      engineRef.current?.setPaused(next);
      return next;
    });
  }, []);

  const handleToggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      if (audioRef.current) {
        audioRef.current.enabled = next;
        if (next) {
          audioRef.current.playChime(440, 0.2, 0.045);
        }
      }
      return next;
    });
  }, []);

  const handleResetParams = useCallback(() => {
    setParams(DEFAULT_PARAMS);
    engineRef.current?.updateParams(DEFAULT_PARAMS);
    engineRef.current?.setCameraPreset('default');
    showTransientNote('시뮬레이션 매개변수와 시점을 초기 상태로 복원했습니다.');
  }, [showTransientNote]);

  const handleTriggerExperiment = useCallback(() => {
    engineRef.current?.triggerPrimaryExperiment();
  }, []);

  const handleSelectCamera = useCallback((preset: CameraPreset) => {
    engineRef.current?.setCameraPreset(preset);
  }, []);

  // Keyboard shortcuts: 1/2/3 modes, Space pause, H collapse HUD
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '1') handleModeChange('spacetime');
      else if (e.key === '2') handleModeChange('lqg');
      else if (e.key === '3') handleModeChange('holography');
      else if (e.key === 'h' || e.key === 'H') setDockCollapsed((c) => !c);
      else if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePause();
      } else if (e.key === 'Escape') {
        setTheoryOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleModeChange, handleTogglePause]);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#060911]">
      {/* Isolated Full-Viewport WebGL Mount Container */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Graceful WebGL Context Loss Overlay */}
      {contextLost && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#060911]/95 px-6 text-center">
          <div className="max-w-sm border border-slate-800 rounded-xl bg-[#0c1322] p-6">
            <h2 className="text-base font-semibold text-slate-100">WebGL 렌더링 컨텍스트가 일시 중단되었습니다</h2>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              브라우저 그래픽 리소스가 복구되는 즉시 시뮬레이션이 자동으로 재개됩니다.
            </p>
          </div>
        </div>
      )}

      {/* Semantic HUD Overlays */}
      <TopBar
        mode={mode}
        onModeChange={handleModeChange}
        theoryOpen={theoryOpen}
        onToggleTheory={() => setTheoryOpen((o) => !o)}
      />

      <PhysicsReadout mode={mode} metrics={metrics} interactionNote={interactionNote} />

      <ControlDock
        mode={mode}
        params={params}
        onChangeParams={handleChangeParams}
        isPaused={isPaused}
        onTogglePause={handleTogglePause}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        onTriggerExperiment={handleTriggerExperiment}
        onSelectCamera={handleSelectCamera}
        onResetParams={handleResetParams}
        collapsed={dockCollapsed}
        onToggleCollapsed={() => setDockCollapsed((c) => !c)}
      />

      <TheoryDrawer open={theoryOpen} mode={mode} onClose={() => setTheoryOpen(false)} />
    </main>
  );
}
