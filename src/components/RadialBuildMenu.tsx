import React, { useEffect, useState } from 'react';
import { BUILD_PIECES } from '../game/gameData';
import type { BuildPieceType } from '../types/game';
import { ItemIcon } from './ItemIcon';

interface RadialBuildMenuProps {
  selectedPiece: BuildPieceType;
  woodCount: number;
  onSelect: (piece: BuildPieceType) => void;
  onClose: () => void;
}

export const RadialBuildMenu: React.FC<RadialBuildMenuProps> = ({
  selectedPiece,
  woodCount,
  onSelect,
  onClose,
}) => {
  const [hovered, setHovered] = useState<BuildPieceType>(selectedPiece);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const idx = Number(e.key) - 1;
      if (idx >= 0 && idx < BUILD_PIECES.length) {
        e.preventDefault();
        onSelect(BUILD_PIECES[idx].type);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSelect]);

  const activeDef = BUILD_PIECES.find((p) => p.type === hovered) ?? BUILD_PIECES[0];
  const cx = 190;
  const cy = 190;
  const rOuter = 172;
  const rInner = 74;
  const n = BUILD_PIECES.length;

  const sectorPath = (i: number) => {
    const gap = 0.04;
    const startA = -Math.PI / 2 + (i / n) * Math.PI * 2 + gap;
    const endA = -Math.PI / 2 + ((i + 1) / n) * Math.PI * 2 - gap;
    const x1 = cx + Math.cos(startA) * rOuter;
    const y1 = cy + Math.sin(startA) * rOuter;
    const x2 = cx + Math.cos(endA) * rOuter;
    const y2 = cy + Math.sin(endA) * rOuter;
    const x3 = cx + Math.cos(endA) * rInner;
    const y3 = cy + Math.sin(endA) * rInner;
    const x4 = cx + Math.cos(startA) * rInner;
    const y4 = cy + Math.sin(startA) * rInner;
    return `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 0 0 ${x4} ${y4} Z`;
  };

  return (
    <div
      className="hud-layer flex items-center justify-center bg-black/45 hud-interactive"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-[min(360px,84vw,82vh)] h-[min(360px,84vw,82vh)] flex items-center justify-center">
        <svg viewBox="0 0 380 380" className="w-full h-full">
          {BUILD_PIECES.map((piece, i) => {
            const isSel = hovered === piece.type;
            const affordable = woodCount >= piece.twigCost;
            return (
              <path
                key={piece.type}
                d={sectorPath(i)}
                fill={
                  isSel
                    ? 'rgba(194, 65, 12, 0.92)'
                    : affordable
                      ? 'rgba(22, 25, 30, 0.92)'
                      : 'rgba(20, 16, 16, 0.9)'
                }
                stroke={isSel ? '#fb923c' : 'rgba(229, 223, 211, 0.25)'}
                strokeWidth={isSel ? 2.5 : 1.2}
                className="radial-slice"
                onMouseEnter={() => setHovered(piece.type)}
                onClick={() => onSelect(piece.type)}
              />
            );
          })}
          <circle
            cx={cx}
            cy={cy}
            r={rInner - 6}
            fill="rgba(16, 18, 22, 0.95)"
            stroke="rgba(217, 119, 6, 0.55)"
            strokeWidth="2"
          />
        </svg>

        {/* Slice Icons */}
        {BUILD_PIECES.map((piece, i) => {
          const midA = -Math.PI / 2 + ((i + 0.5) / n) * Math.PI * 2;
          const rIcon = (rOuter + rInner) * 0.5;
          const leftPct = ((cx + Math.cos(midA) * rIcon) / 380) * 100;
          const topPct = ((cy + Math.sin(midA) * rIcon) / 380) * 100;
          return (
            <button
              key={piece.type}
              type="button"
              onMouseEnter={() => setHovered(piece.type)}
              onClick={() => onSelect(piece.type)}
              aria-label={`Select ${piece.label}`}
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                transform: 'translate(-50%, -50%)',
              }}
              className="absolute flex flex-col items-center gap-0.5 cursor-pointer bg-transparent border-0 p-1"
            >
              <ItemIcon id={piece.type} size={22} />
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-[#f3efe6]">
                {piece.label}
              </span>
            </button>
          );
        })}

        {/* Center Info */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-center px-6">
          <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#e07a24]">
            [{activeDef.hotkey}] Blueprint
          </div>
          <div className="text-xs sm:text-sm font-extrabold text-[#f3efe6] mt-0.5">{activeDef.label}</div>
          <div className="text-[10px] sm:text-[11px] font-semibold tabular-nums text-[#d1d5db] mt-0.5">
            {activeDef.twigCost} Wood
          </div>
          <div className="text-[9px] sm:text-[10px] text-[#9ca3af] mt-0.5 max-w-[96px] leading-tight">
            {activeDef.role}
          </div>
        </div>
      </div>
    </div>
  );
};
