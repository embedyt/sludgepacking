import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Crosshair,
  Eye,
  Flashlight,
  Hammer,
  Hand,
  PackageOpen,
  Pickaxe,
  RotateCw,
  Trash2,
} from 'lucide-react';
import type { EquippedVisualId, ItemId } from '../types/game';

interface MobileControlsProps {
  equippedItem: EquippedVisualId;
  aiming: boolean;
  torchOn: boolean;
  flyMode: boolean;
  hasInteractPrompt: boolean;
  onTouchMove: (x: number, y: number) => void;
  onTouchSprint: (sprint: boolean) => void;
  onTouchLookDelta: (dx: number, dy: number) => void;
  onTouchActionHeld: (held: boolean) => void;
  onTouchJump: () => void;
  onTouchFlyVert: (dir: -1 | 0 | 1) => void;
  onTouchInteract: () => void;
  onToggleAim: () => void;
  onTouchSecondary: () => void;
  onToggleTorch: () => void;
  onDropActive: () => void;
}

const RANGED_ITEMS = new Set<EquippedVisualId>([
  'bow',
  'crossbow',
  'pipe_shotgun',
  'revolver',
  'smg',
  'sniper_rifle',
]);

const TOOL_ITEMS = new Set<EquippedVisualId>([
  'wood_pickaxe',
  'torch',
  'hatchet',
  'pickaxe',
  'salvaged_axe',
  'salvaged_pick',
]);

export const MobileControls: React.FC<MobileControlsProps> = ({
  equippedItem,
  aiming,
  torchOn,
  flyMode,
  hasInteractPrompt,
  onTouchMove,
  onTouchSprint,
  onTouchLookDelta,
  onTouchActionHeld,
  onTouchJump,
  onTouchFlyVert,
  onTouchInteract,
  onToggleAim,
  onTouchSecondary,
  onToggleTorch,
  onDropActive,
}) => {
  const padRef = useRef<HTMLDivElement | null>(null);
  const stickPointerIdRef = useRef<number | null>(null);
  const lookPointerIdRef = useRef<number | null>(null);
  const lastLookPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const actionPointerIdRef = useRef<number | null>(null);

  // Store callbacks in refs so periodic 100ms HUD updates NEVER re-trigger cleanup & stop walking
  const callbacksRef = useRef({
    onTouchMove,
    onTouchSprint,
    onTouchLookDelta,
    onTouchActionHeld,
    onTouchJump,
    onTouchFlyVert,
    onTouchInteract,
    onToggleAim,
    onTouchSecondary,
    onToggleTorch,
    onDropActive,
  });
  callbacksRef.current = {
    onTouchMove,
    onTouchSprint,
    onTouchLookDelta,
    onTouchActionHeld,
    onTouchJump,
    onTouchFlyVert,
    onTouchInteract,
    onToggleAim,
    onTouchSecondary,
    onToggleTorch,
    onDropActive,
  };

  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [stickSprinting, setStickSprinting] = useState(false);
  const [actionPressed, setActionPressed] = useState(false);

  const maxRadius = 32;
  const isRanged = RANGED_ITEMS.has(equippedItem);
  const isBuilder = equippedItem === 'building_plan';
  const isHammer = equippedItem === 'hammer';

  useEffect(() => {
    return () => {
      callbacksRef.current.onTouchMove(0, 0);
      callbacksRef.current.onTouchSprint(false);
      callbacksRef.current.onTouchActionHeld(false);
      callbacksRef.current.onTouchFlyVert(0);
    };
  }, []);

  const updateStickFromClient = (clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxRadius && dist > 0.001) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }
    setKnobOffset({ x: dx, y: dy });
    const normX = Math.max(-1, Math.min(1, dx / maxRadius));
    const normForward = Math.max(-1, Math.min(1, -dy / maxRadius));
    callbacksRef.current.onTouchMove(normX, normForward);
    // Sprint triggers ONLY when pushing the stick high upward (no sticky always-on toggle)
    const sprinting = normForward > 0.78;
    setStickSprinting(sprinting);
    callbacksRef.current.onTouchSprint(sprinting);
  };

  const resetStick = () => {
    stickPointerIdRef.current = null;
    setKnobOffset({ x: 0, y: 0 });
    setStickSprinting(false);
    callbacksRef.current.onTouchMove(0, 0);
    callbacksRef.current.onTouchSprint(false);
  };

  const handleStickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (stickPointerIdRef.current !== null) return;
    stickPointerIdRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic pointer events in tests may not have an active pointer ID
    }
    updateStickFromClient(e.clientX, e.clientY);
  };

  const handleStickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickPointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    updateStickFromClient(e.clientX, e.clientY);
  };

  const handleStickPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickPointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    resetStick();
  };

  // Full-screen touch look drag area (ignores taps on buttons/joystick)
  const handleLookPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lookPointerIdRef.current !== null) return;
    lookPointerIdRef.current = e.pointerId;
    lastLookPosRef.current = { x: e.clientX, y: e.clientY };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore synthetic events
    }
  };

  const handleLookPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lookPointerIdRef.current !== e.pointerId) return;
    const dx = e.clientX - lastLookPosRef.current.x;
    const dy = e.clientY - lastLookPosRef.current.y;
    lastLookPosRef.current = { x: e.clientX, y: e.clientY };
    callbacksRef.current.onTouchLookDelta(dx * 1.45, dy * 1.45);
  };

  const handleLookPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lookPointerIdRef.current === e.pointerId) {
      lookPointerIdRef.current = null;
    }
  };

  const handleActionDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (actionPointerIdRef.current !== null) return;
    actionPointerIdRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore synthetic events
    }
    setActionPressed(true);
    callbacksRef.current.onTouchActionHeld(true);
  };

  const handleActionUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (actionPointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    actionPointerIdRef.current = null;
    setActionPressed(false);
    callbacksRef.current.onTouchActionHeld(false);
  };

  const renderActionIcon = () => {
    if (isRanged || equippedItem === 'fishing_rod') return <Crosshair size={21} />;
    if (isBuilder || isHammer) return <Hammer size={21} />;
    if (TOOL_ITEMS.has(equippedItem)) return <Pickaxe size={21} />;
    if (
      equippedItem === 'flashlight_basic' ||
      equippedItem === 'flashlight_tactical' ||
      equippedItem === 'flashlight_sludge'
    ) {
      return <Flashlight size={21} />;
    }
    return <Hand size={21} />;
  };

  return (
    <div
      className="fixed inset-0 z-[9] pointer-events-none select-none"
      data-testid="mobile-controls"
    >
      {/* Full-screen touch look pad behind HUD controls */}
      <div
        data-testid="touch-look-pad"
        onPointerDown={handleLookPointerDown}
        onPointerMove={handleLookPointerMove}
        onPointerUp={handleLookPointerEnd}
        onPointerCancel={handleLookPointerEnd}
        className="absolute inset-0 pointer-events-auto touch-none"
      />

      {/* Left Thumb Zone: Fly (when enabled) + Virtual Analog Joystick (push high up to sprint) */}
      <div className="absolute left-2.5 bottom-[58px] min-[600px]:bottom-2.5 flex flex-col items-start gap-1.5 pointer-events-none">
        {flyMode && (
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              tabIndex={-1}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                callbacksRef.current.onTouchFlyVert(1);
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                callbacksRef.current.onTouchFlyVert(0);
              }}
              onPointerCancel={() => callbacksRef.current.onTouchFlyVert(0)}
              aria-label="Fly Up"
              className="w-8 h-8 rounded-full bg-[#0c2233]/85 border border-[#38bdf8]/60 text-[#7dd3fc] flex items-center justify-center touch-none cursor-pointer"
            >
              <ArrowUp size={14} />
            </button>
            <button
              type="button"
              tabIndex={-1}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                callbacksRef.current.onTouchFlyVert(-1);
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                callbacksRef.current.onTouchFlyVert(0);
              }}
              onPointerCancel={() => callbacksRef.current.onTouchFlyVert(0)}
              aria-label="Fly Down"
              className="w-8 h-8 rounded-full bg-[#0c2233]/85 border border-[#38bdf8]/60 text-[#7dd3fc] flex items-center justify-center touch-none cursor-pointer"
            >
              <ArrowDown size={14} />
            </button>
          </div>
        )}

        <div
          ref={padRef}
          data-testid="touch-joystick"
          onPointerDown={handleStickPointerDown}
          onPointerMove={handleStickPointerMove}
          onPointerUp={handleStickPointerEnd}
          onPointerCancel={handleStickPointerEnd}
          className={`relative w-24 h-24 rounded-full bg-[#101318]/60 border-2 shadow-lg flex items-center justify-center pointer-events-auto touch-none transition-colors ${
            stickSprinting ? 'border-[#4ade80]' : 'border-white/20'
          }`}
        >
          <span
            className={`absolute top-1 text-[8px] font-extrabold uppercase tracking-wider pointer-events-none ${
              stickSprinting ? 'text-[#4ade80]' : 'text-white/35'
            }`}
          >
            Sprint
          </span>
          <div className="w-14 h-14 rounded-full border border-white/10 pointer-events-none" />
          <div
            className={`absolute w-9 h-9 rounded-full bg-[#e5dfd3]/85 border-2 shadow-md pointer-events-none ${
              stickSprinting ? 'border-[#4ade80]' : 'border-[#fb923c]'
            }`}
            style={{
              transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
            }}
          />
        </div>
      </div>

      {/* Right Thumb Zone: Utility + Interact + Jump + Aim/Rotate + Primary Action */}
      <div className="absolute right-2.5 bottom-[58px] min-[600px]:bottom-5 flex flex-col items-end gap-1.5 pointer-events-none">
        {/* Micro Utility Row: Light + Drop (fire immediately on pointerdown for reliable quick taps) */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            type="button"
            tabIndex={-1}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              callbacksRef.current.onToggleTorch();
            }}
            aria-label="Toggle Light"
            className={`w-8 h-8 rounded-full border flex items-center justify-center touch-none cursor-pointer ${
              torchOn
                ? 'bg-[#2b2210]/90 border-[#fbbf24] text-[#fde68a]'
                : 'bg-[#12151a]/80 border-white/20 text-[#d1d5db]'
            }`}
          >
            <Flashlight size={14} />
          </button>

          <button
            type="button"
            tabIndex={-1}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              callbacksRef.current.onDropActive();
            }}
            aria-label="Drop Active Item"
            className="w-8 h-8 rounded-full bg-[#12151a]/80 border border-white/20 text-[#d1d5db] flex items-center justify-center touch-none cursor-pointer"
          >
            <ArrowDown size={14} />
          </button>
        </div>

        {/* Middle Row: Secondary (Aim / Rotate / Demolish) + Interact */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {(isRanged || isBuilder || isHammer) && (
            <button
              type="button"
              tabIndex={-1}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isRanged) callbacksRef.current.onToggleAim();
                else callbacksRef.current.onTouchSecondary();
              }}
              aria-label={isRanged ? 'Toggle Aim' : isBuilder ? 'Rotate Piece' : 'Demolish Twig'}
              className={`w-10 h-10 rounded-full border flex items-center justify-center touch-none cursor-pointer ${
                aiming
                  ? 'bg-[#2a190d]/90 border-[#fb923c] text-[#fed7aa]'
                  : isHammer
                    ? 'bg-[#2a1414]/85 border-[#ef4444]/60 text-[#fca5a5]'
                    : 'bg-[#12151a]/85 border-white/25 text-[#e5dfd3]'
              }`}
            >
              {isRanged ? (
                <Eye size={16} />
              ) : isBuilder ? (
                <RotateCw size={16} />
              ) : (
                <Trash2 size={16} />
              )}
            </button>
          )}

          <button
            type="button"
            tabIndex={-1}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              callbacksRef.current.onTouchInteract();
            }}
            aria-label="Interact"
            className={`w-11 h-11 rounded-full border-2 flex items-center justify-center touch-none cursor-pointer transition-colors ${
              hasInteractPrompt
                ? 'bg-[#17301e]/95 border-[#4ade80] text-[#86efac] shadow-lg'
                : 'bg-[#12151a]/80 border-white/25 text-[#e5dfd3]'
            }`}
          >
            <PackageOpen size={17} />
          </button>
        </div>

        {/* Bottom Row: Jump + Primary Action/Fire */}
        <div className="flex items-end gap-2 pointer-events-auto">
          <button
            type="button"
            tabIndex={-1}
            data-testid="touch-jump-button"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              callbacksRef.current.onTouchJump();
            }}
            aria-label="Jump"
            className="w-11 h-11 rounded-full bg-[#12151a]/85 active:bg-[#232830] border-2 border-white/25 text-[#f3efe6] flex items-center justify-center touch-none cursor-pointer"
          >
            <ArrowUp size={18} />
          </button>

          <button
            type="button"
            tabIndex={-1}
            data-testid="touch-action-button"
            onPointerDown={handleActionDown}
            onPointerUp={handleActionUp}
            onPointerCancel={handleActionUp}
            aria-label="Use or Attack"
            className={`w-14 h-14 rounded-full border-2 flex items-center justify-center touch-none cursor-pointer shadow-lg transition-transform ${
              actionPressed
                ? 'bg-[#d95216] border-[#fed7aa] text-white scale-95'
                : 'bg-[#c2410c]/90 border-[#fb923c] text-[#faf7f2]'
            }`}
          >
            {renderActionIcon()}
          </button>
        </div>
      </div>
    </div>
  );
};
