import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Shield, Trash2, X } from 'lucide-react';
import { ITEMS, RECIPES } from '../game/gameData';
import { canAfford, getItemCount, type SlotRef } from '../game/rules';
import type { ArmorSlotType, CraftingRecipe, HudSnapshot } from '../types/game';
import { ItemIcon } from './ItemIcon';

interface CraftingModalProps {
  hud: HudSnapshot;
  onCraft: (recipeId: string) => void;
  onMoveSlot: (from: SlotRef, to: SlotRef) => void;
  onQuickMoveSlot: (ref: SlotRef) => void;
  onUseSlot: (ref: SlotRef) => void;
  onDropSlot: (ref: SlotRef, dropAll?: boolean) => void;
  onEquipArmor: (ref: SlotRef) => void;
  onUnequipArmor: (slot: ArmorSlotType) => void;
  onClose: () => void;
}

const CATEGORIES: Array<'All' | CraftingRecipe['category']> = [
  'All',
  'Tools',
  'Armor',
  'Building',
  'Weapons',
  'Survival',
];

const ARMOR_SLOTS: Array<{ key: ArmorSlotType; label: string }> = [
  { key: 'head', label: 'Head' },
  { key: 'chest', label: 'Chest' },
  { key: 'legs', label: 'Legs' },
];

export const CraftingModal: React.FC<CraftingModalProps> = ({
  hud,
  onCraft,
  onMoveSlot,
  onQuickMoveSlot,
  onUseSlot,
  onDropSlot,
  onEquipArmor,
  onUnequipArmor,
  onClose,
}) => {
  const [category, setCategory] = useState<'All' | CraftingRecipe['category']>('All');
  const [selectedSlot, setSelectedSlot] = useState<SlotRef | null>(null);
  const [mobileTab, setMobileTab] = useState<'inventory' | 'craft'>('inventory');
  const hoveredSlotRef = useRef<SlotRef | null>(null);
  const latestRef = useRef({ hud, onDropSlot, selectedSlot });
  latestRef.current = { hud, onDropSlot, selectedSlot };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'KeyX') return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      let targetRef = hoveredSlotRef.current;
      if (!targetRef) {
        const hoveredEl = document.querySelector(
          '[role="dialog"] [data-slot-area]:hover',
        ) as HTMLElement | null;
        const area = hoveredEl?.dataset.slotArea;
        const idxStr = hoveredEl?.dataset.slotIndex;
        if ((area === 'hotbar' || area === 'backpack') && idxStr !== undefined) {
          targetRef = { area, index: Number(idxStr) };
        }
      }
      if (!targetRef) return;

      const { hud: curHud, onDropSlot: dropFn, selectedSlot: curSel } = latestRef.current;
      const list = targetRef.area === 'hotbar' ? curHud.hotbar : curHud.backpack;
      const slot = list[targetRef.index];
      if (!slot || !slot.itemId || slot.count <= 0) return;

      e.preventDefault();
      e.stopPropagation();
      const dropAll = e.shiftKey;
      dropFn(targetRef, dropAll);
      if (
        curSel &&
        curSel.area === targetRef.area &&
        curSel.index === targetRef.index &&
        (dropAll || slot.count <= 1)
      ) {
        setSelectedSlot(null);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  const visibleRecipes =
    category === 'All' ? RECIPES : RECIPES.filter((r) => r.category === category);

  const resourceStrip = [
    { id: 'wood' as const, label: 'Wood', val: hud.resources.wood },
    { id: 'stone' as const, label: 'Stone', val: hud.resources.stone },
    { id: 'metal_ore' as const, label: 'Metal Ore', val: hud.resources.metal_ore },
    { id: 'metal_frags' as const, label: 'Frags', val: hud.resources.metal_frags },
    { id: 'sulfur' as const, label: 'Sulfur', val: hud.resources.sulfur },
    { id: 'sludge' as const, label: 'Sludge', val: hud.resources.sludge },
    { id: 'cloth' as const, label: 'Cloth', val: hud.resources.cloth },
    { id: 'raw_meat' as const, label: 'Meat', val: hud.resources.raw_meat },
  ];

  const handleSlotClick = (ref: SlotRef, e: React.MouseEvent) => {
    const targetList = ref.area === 'hotbar' ? hud.hotbar : hud.backpack;
    const clickedSlot = targetList[ref.index];

    if (e.shiftKey) {
      if (clickedSlot?.itemId) {
        setSelectedSlot(null);
        onQuickMoveSlot(ref);
      }
      return;
    }

    if (!selectedSlot) {
      if (clickedSlot?.itemId) {
        setSelectedSlot(ref);
      }
      return;
    }

    if (selectedSlot.area === ref.area && selectedSlot.index === ref.index) {
      setSelectedSlot(null);
      return;
    }

    onMoveSlot(selectedSlot, ref);
    setSelectedSlot(null);
  };

  const handleSlotDoubleClick = (ref: SlotRef) => {
    const targetList = ref.area === 'hotbar' ? hud.hotbar : hud.backpack;
    const clickedSlot = targetList[ref.index];
    if (!clickedSlot?.itemId) return;
    setSelectedSlot(null);
    onUseSlot(ref);
  };

  const selectedData = selectedSlot
    ? (selectedSlot.area === 'hotbar' ? hud.hotbar : hud.backpack)[selectedSlot.index]
    : null;
  const selectedItemDef = selectedData?.itemId ? ITEMS[selectedData.itemId] : null;
  const isSelectedConsumable = Boolean(
    selectedData?.itemId &&
      (selectedData.itemId === 'cooked_meat' ||
        selectedData.itemId === 'raw_fish' ||
        selectedData.itemId === 'cooked_fish' ||
        selectedData.itemId === 'berries' ||
        selectedData.itemId === 'medkit' ||
        selectedData.itemId === 'sludge_stim'),
  );

  return (
    <div className="hud-layer flex items-center justify-center bg-black/65 hud-interactive p-2 sm:p-3 md:p-5">
      <div
        role="dialog"
        aria-label="Backpack and Crafting Workbench"
        className="rust-surface-solid w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 sm:px-6 sm:py-3.5 border-b border-white/10 shrink-0">
          <div>
            <div className="text-[9px] sm:text-[11px] font-bold tracking-[0.2em] uppercase text-[#4ade80]">
              Backpack, Armor &amp; Field Crafting
            </div>
            <h2 className="text-sm sm:text-xl font-extrabold text-[#f3efe6] tracking-wide">
              INVENTORY &amp; BLUEPRINTS
            </h2>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onClose();
            }}
            aria-label="Close crafting menu"
            className="p-1.5 sm:p-2 bg-[#20242a] hover:bg-[#2b3038] border border-white/15 text-[#e5dfd3] cursor-pointer"
          >
            <X size={17} />
          </button>
        </div>

        {/* Resource Inventory Strip */}
        <div className="px-3 sm:px-6 py-1.5 sm:py-2 bg-[#0f1114] border-b border-white/10 flex flex-nowrap lg:flex-wrap overflow-x-auto gap-1.5 sm:gap-2 shrink-0">
          {resourceStrip.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 bg-[#191c21] border border-white/10 shrink-0"
            >
              <ItemIcon id={r.id} size={13} />
              <span className="hidden lg:inline text-[11px] text-[#9ca3af]">{r.label}</span>
              <span className="text-[11px] sm:text-xs font-bold tabular-nums text-[#f3efe6]">{r.val}</span>
            </div>
          ))}
        </div>

        {/* Mobile Portrait Switcher (hidden on landscape >= 600px) */}
        <div className="flex min-[600px]:hidden border-b border-white/10 shrink-0">
          <button
            type="button"
            onClick={() => setMobileTab('inventory')}
            className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-wider cursor-pointer ${
              mobileTab === 'inventory'
                ? 'bg-[#1b221e] text-[#4ade80] border-b-2 border-[#4ade80]'
                : 'bg-[#101215] text-[#9ca3af]'
            }`}
          >
            Bag &amp; Armor
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('craft')}
            className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-wider cursor-pointer ${
              mobileTab === 'craft'
                ? 'bg-[#251812] text-[#fb923c] border-b-2 border-[#c2410c]'
                : 'bg-[#101215] text-[#9ca3af]'
            }`}
          >
            Blueprints ({visibleRecipes.length})
          </button>
        </div>

        {/* Main Split: Left Armor + Hotbar + Backpack / Right Blueprints */}
        <div className="flex-1 min-h-0 flex flex-col min-[600px]:flex-row overflow-hidden">
          {/* Left Panel */}
          <div
            className={`${
              mobileTab === 'inventory' ? 'flex' : 'hidden min-[600px]:flex'
            } flex-1 min-[600px]:flex-none min-[600px]:w-[44%] lg:w-[370px] shrink-0 bg-[#101215] min-[600px]:border-r border-white/10 p-3 sm:p-4 flex-col gap-2.5 sm:gap-3 overflow-y-auto`}
          >
            {/* Equipped Armor */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#60a5fa] flex items-center gap-1">
                  <Shield size={12} />
                  Equipped Armor
                </span>
                <span className="text-[11px] font-bold tabular-nums text-[#93c5fd]">
                  {hud.armorDefensePct}% Defense
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {ARMOR_SLOTS.map(({ key, label }) => {
                  const equippedId = hud.armor[key];
                  const maxDur = equippedId ? ITEMS[equippedId].maxDurability : undefined;
                  const curDur =
                    equippedId && maxDur ? (hud.armorDurability[key] ?? maxDur) : undefined;
                  const durPct =
                    maxDur && maxDur > 0 && curDur !== undefined
                      ? Math.max(0, Math.min(100, (curDur / maxDur) * 100))
                      : null;
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={!equippedId}
                      onClick={() => equippedId && onUnequipArmor(key)}
                      title={
                        equippedId
                          ? `${ITEMS[equippedId].name}${
                              curDur !== undefined && maxDur
                                ? ` (${Math.ceil(curDur)}/${maxDur})`
                                : ''
                            } · Click to unequip`
                          : `${label} armor slot`
                      }
                      aria-label={
                        equippedId
                          ? `Unequip ${ITEMS[equippedId].name} (${label})`
                          : `${label} armor slot empty`
                      }
                      className={`h-14 relative flex flex-col items-center justify-center border transition-colors ${
                        equippedId
                          ? 'bg-[#14202b] border-[#38bdf8]/45 hover:border-[#7dd3fc] cursor-pointer'
                          : 'bg-[#16191e] border-white/10 cursor-default'
                      }`}
                    >
                      <span className="absolute top-0.5 left-1 text-[9px] font-bold uppercase text-[#9ca3af]">
                        {label}
                      </span>
                      {equippedId ? (
                        <>
                          <ItemIcon id={equippedId} size={24} />
                          <span className="absolute bottom-1.5 right-1 text-[9px] font-bold text-[#7dd3fc]">
                            -{Math.round((ITEMS[equippedId].armorReduction ?? 0) * 100)}%
                          </span>
                          {durPct !== null && (
                            <div className="absolute bottom-0.5 left-1 right-1 h-1 bg-black/70 overflow-hidden">
                              <div
                                className={`h-full ${
                                  durPct <= 25
                                    ? 'bg-[#ef4444]'
                                    : durPct <= 55
                                      ? 'bg-[#f59e0b]'
                                      : 'bg-[#38bdf8]'
                                }`}
                                style={{ width: `${durPct}%` }}
                              />
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-[10px] text-[#4b5563]">Empty</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#e07a24]">
                  Hotbar (6 Slots)
                </span>
                <span className="text-[10px] text-[#9ca3af]">Shift+Click · Double-click</span>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {hud.hotbar.map((slot, idx) => {
                  const ref: SlotRef = { area: 'hotbar', index: idx };
                  const isSel =
                    selectedSlot?.area === 'hotbar' && selectedSlot.index === idx;
                  const maxDur = slot.maxDurability ?? (slot.itemId ? ITEMS[slot.itemId].maxDurability : undefined);
                  const durPct =
                    maxDur && maxDur > 0 && slot.durability !== undefined
                      ? Math.max(0, Math.min(100, (slot.durability / maxDur) * 100))
                      : null;
                  return (
                    <button
                      key={`hb-${idx}`}
                      type="button"
                      data-slot-area="hotbar"
                      data-slot-index={idx}
                      onClick={(e) => handleSlotClick(ref, e)}
                      onDoubleClick={() => handleSlotDoubleClick(ref)}
                      onMouseEnter={() => {
                        hoveredSlotRef.current = ref;
                      }}
                      onMouseLeave={() => {
                        if (hoveredSlotRef.current?.area === 'hotbar' && hoveredSlotRef.current.index === idx) {
                          hoveredSlotRef.current = null;
                        }
                      }}
                      aria-label={
                        slot.itemId
                          ? `Hotbar ${idx + 1}: ${ITEMS[slot.itemId].name}`
                          : `Hotbar ${idx + 1}: Empty`
                      }
                      className={`h-11 sm:h-13 relative flex items-center justify-center border cursor-pointer transition-colors ${
                        isSel
                          ? 'bg-[#1c2b1e] border-[#4ade80]'
                          : 'bg-[#181b20] border-white/15 hover:border-white/35'
                      }`}
                    >
                      <span className="absolute top-0.5 left-1 text-[9px] font-bold text-[#9ca3af]">
                        {idx + 1}
                      </span>
                      {slot.itemId && <ItemIcon id={slot.itemId} size={24} />}
                      {slot.itemId && slot.count > 1 && (
                        <span className="absolute bottom-0.5 right-1 text-[10px] font-black tabular-nums text-[#f3efe6]">
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
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#4ade80]">
                  Backpack (18 Slots)
                </span>
                <span className="text-[10px] text-[#9ca3af]">Hover + X to throw</span>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {hud.backpack.map((slot, idx) => {
                  const ref: SlotRef = { area: 'backpack', index: idx };
                  const isSel =
                    selectedSlot?.area === 'backpack' && selectedSlot.index === idx;
                  const maxDur = slot.maxDurability ?? (slot.itemId ? ITEMS[slot.itemId].maxDurability : undefined);
                  const durPct =
                    maxDur && maxDur > 0 && slot.durability !== undefined
                      ? Math.max(0, Math.min(100, (slot.durability / maxDur) * 100))
                      : null;
                  return (
                    <button
                      key={`bp-${idx}`}
                      type="button"
                      data-slot-area="backpack"
                      data-slot-index={idx}
                      onClick={(e) => handleSlotClick(ref, e)}
                      onDoubleClick={() => handleSlotDoubleClick(ref)}
                      onMouseEnter={() => {
                        hoveredSlotRef.current = ref;
                      }}
                      onMouseLeave={() => {
                        if (hoveredSlotRef.current?.area === 'backpack' && hoveredSlotRef.current.index === idx) {
                          hoveredSlotRef.current = null;
                        }
                      }}
                      aria-label={
                        slot.itemId
                          ? `Backpack ${idx + 1}: ${ITEMS[slot.itemId].name}`
                          : `Backpack ${idx + 1}: Empty`
                      }
                      className={`h-11 sm:h-13 relative flex items-center justify-center border cursor-pointer transition-colors ${
                        isSel
                          ? 'bg-[#1c2b1e] border-[#4ade80]'
                          : 'bg-[#181b20] border-white/12 hover:border-white/35'
                      }`}
                    >
                      {slot.itemId && <ItemIcon id={slot.itemId} size={24} />}
                      {slot.itemId && slot.count > 1 && (
                        <span className="absolute bottom-0.5 right-1 text-[10px] font-black tabular-nums text-[#f3efe6]">
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
                })}
              </div>
            </div>

            {/* PC Quick Binds Explanation */}
            <div
              data-testid="inventory-quick-binds"
              className="px-2.5 py-2 bg-[#14171c] border border-white/10 text-[10px] sm:text-[11px] text-[#cbd5e1] flex flex-col gap-1"
            >
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#93c5fd]">
                <Keyboard size={12} />
                Quick Binds
              </div>
              <div className="flex flex-wrap gap-x-2.5 gap-y-1 leading-snug text-[#9ca3af]">
                <span>
                  <strong className="text-[#f3efe6]">Shift+Click</strong> Move Hotbar/Bag
                </span>
                <span>
                  <strong className="text-[#f3efe6]">Double-Click</strong> Use / Equip
                </span>
                <span>
                  <strong className="text-[#f3efe6]">Hover+X</strong> Throw (Shift+X stack)
                </span>
              </div>
            </div>

            {/* Selected Slot Inspector + Equip / Use / Throw Away Button */}
            <div className="mt-auto p-3 bg-[#171a1f] border border-white/12 flex items-center justify-between gap-2">
              {selectedSlot && selectedData?.itemId && selectedItemDef ? (
                <>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#f3efe6] truncate">
                      {selectedItemDef.name}
                      {selectedData.count > 1 ? ` ×${selectedData.count}` : ''}
                      {(selectedData.maxDurability ?? selectedItemDef.maxDurability) &&
                      selectedData.durability !== undefined
                        ? ` · ${Math.ceil(selectedData.durability)}/${selectedData.maxDurability ?? selectedItemDef.maxDurability}`
                        : ''}
                    </div>
                    <div className="text-[11px] text-[#9ca3af] truncate">
                      {selectedItemDef.category === 'armor'
                        ? 'Double-click or press Equip'
                        : isSelectedConsumable
                          ? 'Double-click or press Use'
                          : 'Click another slot to swap or drop'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {selectedItemDef.category === 'armor' && (
                      <button
                        type="button"
                        onClick={() => {
                          onEquipArmor(selectedSlot);
                          setSelectedSlot(null);
                        }}
                        className="px-2.5 py-1.5 bg-[#0284c7] hover:bg-[#0369a1] text-[#f0f9ff] text-xs font-bold uppercase tracking-wider cursor-pointer"
                      >
                        Equip
                      </button>
                    )}
                    {isSelectedConsumable && (
                      <button
                        type="button"
                        onClick={() => {
                          onUseSlot(selectedSlot);
                          if (selectedData.count <= 1) setSelectedSlot(null);
                        }}
                        className="px-2.5 py-1.5 bg-[#15803d] hover:bg-[#166534] text-[#f0fdf4] text-xs font-bold uppercase tracking-wider cursor-pointer"
                      >
                        Use
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        onDropSlot(selectedSlot, true);
                        setSelectedSlot(null);
                      }}
                      className="px-2.5 py-1.5 bg-[#7f1d1d] hover:bg-[#991b1b] text-[#fecaca] text-xs font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 size={13} />
                      Drop
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-xs text-[#9ca3af]">
                  Click a slot to swap, Shift+Click to quick-move, or Double-click to use/equip.
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Category Filters + Recipes */}
          <div
            className={`${
              mobileTab === 'craft' ? 'flex' : 'hidden min-[600px]:flex'
            } flex-1 min-h-0 flex-col overflow-hidden`}
          >
            <div className="px-3 sm:px-5 pt-2.5 pb-2 flex flex-wrap gap-1.5 sm:gap-2 border-b border-white/10 shrink-0">
              {CATEGORIES.map((cat) => {
                const active = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-2.5 py-1 sm:px-3.5 sm:py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors ${
                      active
                        ? 'bg-[#c2410c] text-[#faf7f2] border border-[#fb923c]/50'
                        : 'bg-[#1a1d22] text-[#9ca3af] hover:text-[#e5dfd3] border border-white/10'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            <div className="p-2.5 sm:p-5 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-3">
              {visibleRecipes.map((recipe) => {
                const item = ITEMS[recipe.outputItem];
                const affordable = canAfford(
                  hud.hotbar,
                  hud.backpack,
                  hud.resources,
                  recipe.ingredients,
                );
                return (
                  <div
                    key={recipe.id}
                    className={`p-3.5 flex flex-col justify-between border transition-colors ${
                      affordable
                        ? 'bg-[#1a1d22] border-[#d97706]/35'
                        : 'bg-[#14161a] border-white/10 opacity-80'
                    }`}
                  >
                    <div>
                      <div className="flex items-start gap-2.5">
                        <div className="w-10 h-10 shrink-0 bg-[#0e1013] border border-white/12 flex items-center justify-center">
                          <ItemIcon id={recipe.outputItem} size={24} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-sm font-bold text-[#f3efe6] truncate">
                              {item.name}
                            </h3>
                            {recipe.outputCount > 1 && (
                              <span className="text-xs font-bold text-[#e07a24] tabular-nums">
                                ×{recipe.outputCount}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#d97706]">
                            {item.hotkeyRole}
                          </div>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-[#9ca3af] leading-snug">
                        {item.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-white/10">
                      <div className="flex flex-wrap gap-1.5 mb-2.5">
                        {recipe.ingredients.map((ing) => {
                          const have = getItemCount(
                            hud.hotbar,
                            hud.backpack,
                            hud.resources,
                            ing.itemId,
                          );
                          const ok = have >= ing.count;
                          return (
                            <div
                              key={ing.itemId}
                              className={`flex items-center gap-1 px-2 py-0.5 text-[11px] border ${
                                ok
                                  ? 'bg-[#142217] border-[#4d7c0f]/45 text-[#bef264]'
                                  : 'bg-[#251515] border-[#dc2626]/40 text-[#fca5a5]'
                              }`}
                            >
                              <ItemIcon id={ing.itemId} size={13} />
                              <span className="tabular-nums font-semibold">
                                {have}/{ing.count}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        disabled={!affordable}
                        onClick={(e) => {
                          e.currentTarget.blur();
                          onCraft(recipe.id);
                        }}
                        className={`w-full py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                          affordable
                            ? 'bg-[#c2410c] hover:bg-[#d95216] text-[#faf7f2] cursor-pointer'
                            : 'bg-[#202328] text-[#6b7280] cursor-not-allowed'
                        }`}
                      >
                        {affordable ? `Craft ${item.name}` : 'Insufficient Resources'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
