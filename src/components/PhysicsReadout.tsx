import { PhysicsMetrics, QuantumMode } from '../physics/quantumGravityMath';

interface PhysicsReadoutProps {
  mode: QuantumMode;
  metrics: PhysicsMetrics;
  interactionNote: string | null;
}

export function PhysicsReadout({ mode, metrics, interactionNote }: PhysicsReadoutProps) {
  const modeHeader =
    mode === 'spacetime'
      ? {
          title: '시공간 거품과 사건의 지평선',
          hint: '격자를 클릭해 중력 렌즈 광자를 발사하거나 드래그하여 시점을 회전하세요.',
        }
      : mode === 'lqg'
        ? {
            title: '루프 양자중력 스핀 네트워크',
            hint: '개별 스핀 링크를 클릭하면 SU(2) 양자수 j가 여기되며 양자 면적이 갱신됩니다.',
          }
        : {
            title: '홀로그래피 AdS₃/CFT₂ 얽힘 기하',
            hint: '외부 경계 구면을 클릭해 ER=EPR 얽힘 쌍과 벌크 측지선을 생성하세요.',
          };

  return (
    <section
      aria-label="실시간 물리량 관측값"
      className="fixed top-[72px] left-5 md:left-7 z-10 max-w-md pointer-events-none select-none"
    >
      <h1 className="text-base md:text-lg font-semibold text-slate-100 tracking-tight text-balance">
        {modeHeader.title}
      </h1>
      <p className="mt-1 text-xs text-slate-400 leading-relaxed max-w-sm">
        {interactionNote || modeHeader.hint}
      </p>

      {/* Unboxed tabular monospace physics readout strip */}
      <dl className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2.5">
        {mode === 'spacetime' && (
          <>
            <div>
              <dt className="text-[11px] text-slate-400">관측 스케일 L</dt>
              <dd className="text-sm font-mono tabular-nums font-medium text-cyan-300 mt-0.5">
                {metrics.lengthScalePlanck}
              </dd>
              <dd className="text-[11px] font-mono tabular-nums text-slate-500">
                {metrics.lengthScaleMeters}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-400">계량 요동 Δg/g</dt>
              <dd className="text-sm font-mono tabular-nums font-medium text-amber-300 mt-0.5">
                {metrics.metricUncertainty}
              </dd>
              <dd className="text-[11px] font-mono tabular-nums text-slate-500">
                r_s = {metrics.schwarzschildRadiusPlanck}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-400">호킹 온도 / 엔트로피</dt>
              <dd className="text-sm font-mono tabular-nums font-medium text-slate-100 mt-0.5">
                {metrics.hawkingTempPlanck}
              </dd>
              <dd className="text-[11px] font-mono tabular-nums text-slate-500">
                S_BH = {metrics.bekensteinEntropy}
              </dd>
            </div>
          </>
        )}

        {mode === 'lqg' && (
          <>
            <div>
              <dt className="text-[11px] text-slate-400">양자화 총 면적 A</dt>
              <dd className="text-sm font-mono tabular-nums font-medium text-cyan-300 mt-0.5">
                {metrics.totalQuantizedArea}
              </dd>
              <dd className="text-[11px] font-mono tabular-nums text-slate-500">
                링크 {metrics.linkCount}개 · 노드 {metrics.nodeCount}개
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-400">양자 부피 V</dt>
              <dd className="text-sm font-mono tabular-nums font-medium text-amber-300 mt-0.5">
                {metrics.totalQuantizedVolume}
              </dd>
              <dd className="text-[11px] font-mono tabular-nums text-slate-500">
                평균 스핀 ⟨j⟩ = {metrics.meanSpinJ}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-400">기하 위상</dt>
              <dd className="text-xs font-medium text-slate-200 mt-1">
                {metrics.bouncePhaseLabel}
              </dd>
            </div>
          </>
        )}

        {mode === 'holography' && (
          <>
            <div>
              <dt className="text-[11px] text-slate-400">류-타카야나기 엔트로피</dt>
              <dd className="text-sm font-mono tabular-nums font-medium text-cyan-300 mt-0.5">
                {metrics.rtEntropy}
              </dd>
              <dd className="text-[11px] font-mono tabular-nums text-slate-500">
                벌크 측지선 {metrics.geodesicCount}개
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-400">중심 전하 c</dt>
              <dd className="text-sm font-mono tabular-nums font-medium text-slate-100 mt-0.5">
                {metrics.centralChargeC}
              </dd>
              <dd className="text-[11px] font-mono tabular-nums text-slate-500">
                3L / (2G_N)
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-400">지평선 열적 기여</dt>
              <dd className="text-sm font-mono tabular-nums font-medium text-amber-300 mt-0.5">
                {metrics.horizonEntropyRatio}
              </dd>
              <dd className="text-[11px] font-mono tabular-nums text-slate-500">
                ER = EPR 경계쌍
              </dd>
            </div>
          </>
        )}
      </dl>
    </section>
  );
}
