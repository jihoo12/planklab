import { BookOpen, X } from 'lucide-react';
import { QuantumMode } from '../physics/quantumGravityMath';

interface TopBarProps {
  mode: QuantumMode;
  onModeChange: (mode: QuantumMode) => void;
  theoryOpen: boolean;
  onToggleTheory: () => void;
}

const MODE_ITEMS: { id: QuantumMode; label: string }[] = [
  { id: 'spacetime', label: '시공간 거품' },
  { id: 'lqg', label: '루프 양자중력' },
  { id: 'holography', label: '홀로그래피 AdS/CFT' },
];

export function TopBar({ mode, onModeChange, theoryOpen, onToggleTheory }: TopBarProps) {
  return (
    <header className="fixed top-0 inset-x-0 z-20 h-14 px-5 md:px-7 flex items-center justify-between gap-6 bg-[#070b14]/92 border-b border-slate-800/80">
      {/* Zone 1: Single-line Brand Wordmark */}
      <span className="text-base md:text-lg font-semibold tracking-tight text-slate-100 whitespace-nowrap shrink-0">
        Planck Lab
      </span>

      {/* Zone 2: Clean Single-Line Mode Navigation */}
      <nav aria-label="양자중력 시뮬레이션 모드" className="flex items-center gap-5 md:gap-7 overflow-x-auto no-scrollbar">
        {MODE_ITEMS.map((item) => {
          const active = mode === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onModeChange(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`relative h-14 flex items-center text-xs md:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:text-cyan-300 ${
                active ? 'text-slate-50' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.label}
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 inset-x-0 h-[2px] bg-cyan-400"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Single Primary Action */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onToggleTheory}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
            theoryOpen
              ? 'bg-cyan-500/15 text-cyan-200 border-cyan-500/45'
              : 'bg-slate-900/90 text-slate-200 border-slate-700/80 hover:border-slate-500 hover:text-white'
          }`}
        >
          {theoryOpen ? <X className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
          <span>{theoryOpen ? '해설 닫기' : '이론 해설'}</span>
        </button>
      </div>
    </header>
  );
}
