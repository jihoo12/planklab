import { X } from 'lucide-react';
import { QuantumMode } from '../physics/quantumGravityMath';

interface TheoryDrawerProps {
  open: boolean;
  mode: QuantumMode;
  onClose: () => void;
}

const THEORY_CONTENT: Record<
  QuantumMode,
  {
    subtitle: string;
    title: string;
    equation: string;
    equationCaption: string;
    summary: string;
    keyPoints: { heading: string; detail: string }[];
  }
> = {
  spacetime: {
    subtitle: '일반상대론과 양자장론의 경계',
    title: '시공간 거품과 호킹 복사',
    equation: 'Δg_μν ~ ℓ_P / L ,   T_H = ℏc³ / (8π G M k_B)',
    equationCaption: '플랑크 길이 ℓ_P = √(ℏG / c³) ≈ 1.616 × 10⁻³⁵ m',
    summary:
      '거시적 스케일에서 시공간은 아인슈타인의 일반상대론이 기술하듯 매끄러운 연속체(다양체)로 보입니다. 그러나 관측 스케일 L을 플랑크 길이 ℓ_P에 가깝게 좁히면 하이젠베르크 불확정성 원리로 인해 중력장 계량 자체에 격렬한 양자 요동(존 휠러의 시공간 거품)이 나타납니다.',
    keyPoints: [
      {
        heading: '사건의 지평선과 호킹 복사',
        detail:
          '강한 중력 우물 주변의 진공에서는 가상 입자-반입자 쌍이 끊임없이 생성됩니다. 음의 에너지를 지닌 짝(청색)이 지평선 안으로 떨어지면, 양의 에너지를 지닌 짝(황색)이 외부로 탈출해 블랙홀을 서서히 증발시킵니다.',
      },
      {
        heading: '광자 측지선과 양자 분산',
        detail:
          '격자를 클릭해 발사한 광자는 질량에 의해 휘어진 시공간의 측지선을 따라 굴절됩니다. 플랑크 스케일에 가까워질수록 시공 거품으로 인해 광자 경로에 미세한 양자 분산이 발생합니다.',
      },
    ],
  },
  lqg: {
    subtitle: '배경 독립적 양자 기하학',
    title: '루프 양자중력과 스핀 네트워크',
    equation: 'A = 8π γ ℓ_P² ∑ √(j_i (j_i + 1))',
    equationCaption: 'SU(2) 스핀 양자수 j ∈ {1/2, 1, 3/2, 2, …}, 이미르지 상수 γ ≈ 0.2375',
    summary:
      '루프 양자중력(LQG)은 시공간 자체가 연속체가 아니라 최소 단위의 이산적 양자(공간 원자)로 직조되어 있다고 봅니다. 스핀 네트워크의 각 노드는 양자화된 부피를, 노드를 잇는 링크는 양자화된 면적을 결정합니다.',
    keyPoints: [
      {
        heading: '직접 조작: 스핀 양자수 여기',
        detail:
          '3D 네트워크의 링크를 클릭하면 해당 모서리의 SU(2) 스핀 양자수 j가 한 단계 상승합니다. 각 링크의 면적 고유값 √(j(j+1))이 불연속적으로 점프하며 전체 양자 면적과 부피가 실시간으로 재계산됩니다.',
      },
      {
        heading: '특이점 해소와 빅 바운스',
        detail:
          '고전 일반상대론은 무한 밀도의 특이점을 예측하지만, LQG에서는 공간 밀도가 플랑크 밀도 ρ_P에 도달하면 양자 기하의 반발력이 작용해 붕괴를 되튀겨 내는 빅 바운스(Big Bounce)가 일어납니다.',
      },
    ],
  },
  holography: {
    subtitle: '양자 얽힘에서 창발하는 중력',
    title: '홀로그래피 원리와 AdS/CFT 대응',
    equation: 'S_A = Area(γ_A) / (4 G_N ℏ)',
    equationCaption: '류-타카야나기(Ryu-Takayanagi) 공식 및 ER = EPR 대응',
    summary:
      '홀로그래피 원리는 d+1차원 벌크(내부)의 중력 이론이 그 공간을 둘러싼 d차원 경계의 중력 없는 양자장론(CFT)과 수학적으로 완전히 동등함을 보여줍니다. 즉, 3차원 중력 시공간은 경계면의 양자 얽힘으로부터 창발합니다.',
    keyPoints: [
      {
        heading: 'ER = EPR 얽힘 측지선',
        detail:
          '경계 구면 위의 두 지점이 강하게 얽혀 있을수록(EPR) 벌크 내부를 가로지르는 최단 쌍곡 측지선(ER 웜홀 연결)이 공간을 단단히 엮어줍니다. 경계 구면을 클릭해 새 얽힘 쌍을 직접 추가해 보세요.',
      },
      {
        heading: '벌크 블랙홀과 최소 곡면 회피',
        detail:
          '중앙 블랙홀 지평선 반경을 키우면 벌크 측지선(류-타카야나기 최소 곡면)이 지평선 바깥을 감싸도록 밀려나며, 경계 양자계의 열적 엔트로피가 블랙홀 지평선 면적에 비례하게 됩니다.',
      },
    ],
  },
};

export function TheoryDrawer({ open, mode, onClose }: TheoryDrawerProps) {
  if (!open) return null;

  const content = THEORY_CONTENT[mode];

  return (
    <aside
      aria-label="양자중력 이론 해설"
      className="fixed top-14 right-0 bottom-0 z-30 w-full max-w-md bg-[#090e1a]/96 border-l border-slate-800 flex flex-col"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80">
        <div>
          <p className="text-xs text-cyan-400 font-medium">{content.subtitle}</p>
          <h2 className="text-base font-semibold text-slate-100 mt-0.5">{content.title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="이론 해설 닫기"
          className="p-2 text-slate-400 hover:text-slate-100 rounded-md hover:bg-slate-800/70 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto lab-scroll px-6 py-5 space-y-6">
        {/* Core Equation Block */}
        <div className="p-4 rounded-lg bg-[#0d1424] border border-slate-800">
          <div className="font-mono text-sm text-cyan-200 tracking-tight break-words">
            {content.equation}
          </div>
          <p className="mt-2 text-[11px] font-mono text-slate-400">{content.equationCaption}</p>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed">{content.summary}</p>

        <div className="space-y-5 pt-2 border-t border-slate-800/80">
          {content.keyPoints.map((kp) => (
            <div key={kp.heading}>
              <h3 className="text-sm font-semibold text-slate-100">{kp.heading}</h3>
              <p className="mt-1.5 text-xs md:text-[13px] text-slate-400 leading-relaxed">
                {kp.detail}
              </p>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-slate-800/80 text-xs text-slate-400 space-y-1.5">
          <div className="font-medium text-slate-300">단축키 안내</div>
          <div className="flex justify-between font-mono text-[11px]">
            <span>모드 전환</span>
            <span className="text-slate-300">1 · 2 · 3</span>
          </div>
          <div className="flex justify-between font-mono text-[11px]">
            <span>재생 / 일시정지</span>
            <span className="text-slate-300">Space</span>
          </div>
          <div className="flex justify-between font-mono text-[11px]">
            <span>컨트롤 도크 숨기기</span>
            <span className="text-slate-300">H</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
