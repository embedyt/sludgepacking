import React, { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Package, X } from 'lucide-react';
import { CHEST_COLS, ITEMS } from '../game/gameData';
import type { ContainerSlotRef } from '../game/rules';
import type { HudSnapshot } from '../types/game';
import { ItemIcon } from './ItemIcon';

interface ChestModalProps {
  hud: HudSnapshot;
  onMoveSlot: (from: ContainerSlotRef, to: ContainerSlotRef) => void;
  onQuickTransfer: (from: ContainerSlotRef) => void;
  onTransferAll: (dir: 'to_chest' | 'from_chest') => void;
  onClose: () => void;
}

export const ChestModal: React.FC<ChestModalProps> = ({
  hud,
  onMoveSlot,
  onQuickTransfer,
  onTransferAll,
  onClose,
}) => {
  const [selected, setSelected] = useState<ContainerSlotRef | null>(null);
  const chestSlots = hud.activeChestSlots ?? [];

  const getList = (area: ContainerSlotRef['area']) => {
    if (area === 'chest') return chestSlots;
    if (area === 'hotbar') return hud.hotbar;
    return hud.backpack;
  };

  const handleClick = (ref: ContainerSlotRef, e: React.MouseEvent) => {
    const slot = getList(ref.area)[ref.index];
    if (e.shiftKey) {
      if (slot?.itemId) {
        setSelected(null);
        onQuickTransfer(ref);
      }
      return;
    }
    if (!selected) {
      if (slot?.itemId) setSelected(ref);
      return;
    }
    if (selected.area === ref.area && selected.index === ref.index) {
      setSelected(null);
      return;
    }
    onMoveSlot(selected, ref);
    setSelected(null);
  };

  const renderSlot = (ref: ContainerSlotRef, labelHint?: string) => {
    const slot = getList(ref.area)[ref.index];
    const isSel = selected?.area === ref.area && selected?.index === ref.index;
    const itemDef = slot?.itemId ? ITEMS[slot.itemId] : null;
    const maxDur = slot?.maxDurability ?? itemDef?.maxDurability;
    const durPct =
      maxDur && maxDur > 0 && slot?.durability !== undefined
        ? Math.max(0, Math.min(100, (slot.durability / maxDur) * 100))
        : null;
    return (
      <button
        key={`${ref.area}-${ref.index}`}
        type="button"
        onClick={(e) => handleClick(ref, e)}
        onDoubleClick={() => {
          if (slot?.itemId) {
            setSelected(null);
            onQuickTransfer(ref);
          }
        }}
        title={itemDef ? `${itemDef.name} (Click to move, Shift+Click or Double-click to quick transfer)` : 'Empty Slot'}
        aria-label={itemDef ? `${ref.area} slot ${ref.index + 1}: ${itemDef.name}` : `Empty ${ref.area} slot ${ref.index + 1}`}
        className={`relative h-10 sm:h-14 bg-[#14171c] border transition-colors flex items-center justify-center cursor-pointer ${
          isSel
            ? 'border-[#fb923c] bg-[#241a13]'
            : 'border-white/12 hover:border-white/30'
        }`}
      >
        {labelHint && (
          <span className="absolute top-0.5 left-1 text-[9px] font-bold text-[#6b7280]">
            {labelHint}
          </span>
        )}
        {slot?.itemId && <ItemIcon id={slot.itemId} size={22} />}
        {slot?.itemId && slot.count > 1 && (
          <span className="absolute bottom-0.5 right-1 text-[10px] font-black tabular-nums text-[#f3efe6] hud-text-shadow">
            {slot.count}
          </span>
        )}
        {durPct !== null && (
          <div className="absolute bottom-0.5 left-1 right-1 h-1 bg-black/70 overflow-hidden">
            <div
              className={`h-full ${
                durPct <= 25 ? 'bg-[#ef4444]' : durPct <= 55 ? 'bg-[#f59e0b]' : 'bg-[#4ade80]'
              }`}
              style={{ width: `${durPct}%` }}
            />
          </div>
        )}
      </button>
    );
  };

  return (
    <div
      className="hud-layer flex items-center justify-center bg-black/65 hud-interactive p-2 sm:p-3 md:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Storage Chest 6 by 4"
    >
      <div className="rust-surface-solid w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 sm:px-6 sm:py-3.5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <Package size={17} className="text-[#fbbf24]" />
            <div>
              <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.22em] text-[#fbbf24]">
                Wooden Storage Chest · 6 × 4
              </div>
              <h2 className="text-sm sm:text-lg font-extrabold tracking-wide text-[#f3efe6]">
                CONTAINER &amp; INVENTORY
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close storage chest"
            className="p-1.5 sm:p-2 bg-[#20242a] hover:bg-[#2b3038] border border-white/15 text-[#e5dfd3] cursor-pointer"
          >
            <X size={17} />
          </button>
        </div>

        <div className="p-3 sm:p-5 overflow-y-auto grid grid-cols-1 min-[600px]:grid-cols-2 gap-3.5 sm:gap-5">
          {/* Left: 6x4 Chest Grid */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#fbbf24]">
                Chest Storage (24 Slots)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onTransferAll('to_chest')}
                  className="px-2.5 py-1 bg-[#1b221e] hover:bg-[#232f28] border border-[#4ade80]/35 text-[10px] font-bold uppercase text-[#86efac] cursor-pointer flex items-center gap-1"
                >
                  <ArrowDownToLine size={11} />
                  Deposit Bag
                </button>
                <button
                  type="button"
                  onClick={() => onTransferAll('from_chest')}
                  className="px-2.5 py-1 bg-[#1e222a] hover:bg-[#282e38] border border-white/15 text-[10px] font-bold uppercase text-[#e5dfd3] cursor-pointer flex items-center gap-1"
                >
                  <ArrowUpFromLine size={11} />
                  Take All
                </button>
              </div>
            </div>

            <div
              className="grid gap-1.5"
              style={{ gridTemplateColumns: `repeat(${CHEST_COLS}, minmax(0, 1fr))` }}
            >
              {chestSlots.map((_, idx) => renderSlot({ area: 'chest', index: idx }))}
            </div>
          </div>

          {/* Right: Backpack + Hotbar */}
          <div className="flex flex-col gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#9ca3af] mb-2">
                Backpack (18 Slots)
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {hud.backpack.map((_, idx) => renderSlot({ area: 'backpack', index: idx }))}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#9ca3af] mb-2">
                Hotbar (6 Slots)
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {hud.hotbar.map((_, idx) =>
                  renderSlot({ area: 'hotbar', index: idx }, String(idx + 1)),
                )}
              </div>
            </div>

            <p className="text-[11px] text-[#9ca3af] mt-1">
              Click a slot to swap, or Shift+Click / Double-click an item to quick-transfer.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
