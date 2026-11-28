import React from 'react';
import type { BuildPieceType, ItemId } from '../types/game';

interface ItemIconProps {
  id: ItemId | BuildPieceType;
  size?: number;
  className?: string;
}

export const ItemIcon: React.FC<ItemIconProps> = ({ id, size = 28, className = '' }) => {
  switch (id) {
    case 'wood_pickaxe':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <path d="M6 20L15 9" stroke="#16181c" strokeWidth="4.2" strokeLinecap="round" />
          <path d="M6 20L15 9" stroke="#9a6b3e" strokeWidth="2.2" strokeLinecap="round" />
          <path
            d="M7 5C12 4.5 17 7.5 19.5 13L17 13.5C15 9.5 11.5 7.5 7.5 7.5Z"
            fill="#b47e49"
            stroke="#16181c"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'torch':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <path
            d="M12 2C14.5 4.8 15.5 7 14 9.5C13.2 10.7 11 11 10 9.5C8.5 7.2 9.8 4.2 12 2Z"
            fill="#fb923c"
            stroke="#16181c"
            strokeWidth="1.4"
          />
          <path d="M12 4.5C13 6 13.2 7.5 12 8.5C10.9 7.5 11.1 6 12 4.5Z" fill="#fde047" />
          <path
            d="M10 10L14 10L13 21L11 21Z"
            fill="#8b5a2b"
            stroke="#16181c"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <rect x="9.5" y="9.5" width="5" height="2.8" rx="0.6" fill="#9a3412" stroke="#16181c" strokeWidth="1.2" />
        </svg>
      );
    case 'flashlight_basic':
    case 'flashlight_tactical':
    case 'flashlight_sludge': {
      const body =
        id === 'flashlight_sludge' ? '#1e3a2c' : id === 'flashlight_tactical' ? '#334155' : '#64748b';
      const lens =
        id === 'flashlight_sludge' ? '#4ade80' : id === 'flashlight_tactical' ? '#e0f2fe' : '#fde047';
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <path d="M4 17L12 9L15 12L7 20Z" fill={body} stroke="#16181c" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M11 8L15 4L20 9L16 13Z" fill="#94a3b8" stroke="#16181c" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M16 5L19 8" stroke={lens} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M18.5 3.5L21 2.5M20 6L22 5.5" stroke={lens} strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    }
    case 'turret_item':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <path d="M6 20L10 13M18 20L14 13M12 20V13" stroke="#475569" strokeWidth="2.2" strokeLinecap="round" />
          <rect x="7" y="7" width="9" height="6" rx="1.2" fill="#334155" stroke="#16181c" strokeWidth="1.5" />
          <rect x="16" y="8.8" width="5" height="2.4" fill="#94a3b8" stroke="#16181c" strokeWidth="1.2" />
          <circle cx="11.5" cy="10" r="1.4" fill="#ef4444" />
        </svg>
      );
    case 'hatchet':
    case 'salvaged_axe': {
      const steel = id === 'salvaged_axe';
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <path d="M6 20L15 7" stroke="#16181c" strokeWidth="4.4" strokeLinecap="round" />
          <path d="M6 20L15 7" stroke={steel ? '#64748b' : '#9a6b3e'} strokeWidth="2.4" strokeLinecap="round" />
          <path
            d="M12 5L20 6L21 12L14 12Z"
            fill={steel ? '#cbd5e1' : '#94a3b8'}
            stroke="#16181c"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          {steel && <path d="M18.5 6.5L19.8 11.2" stroke="#f97316" strokeWidth="1.4" strokeLinecap="round" />}
        </svg>
      );
    }
    case 'pickaxe':
    case 'salvaged_pick': {
      const steel = id === 'salvaged_pick';
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <path d="M6 20L15 9" stroke="#16181c" strokeWidth="4.2" strokeLinecap="round" />
          <path d="M6 20L15 9" stroke={steel ? '#64748b' : '#9a6b3e'} strokeWidth="2.2" strokeLinecap="round" />
          <path
            d="M7 5C12 4.5 17 7.5 19.5 13L17 13.5C15 9.5 11.5 7.5 7.5 7.5Z"
            fill={steel ? '#cbd5e1' : '#94a3b8'}
            stroke="#16181c"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          {steel && <circle cx="14.5" cy="8.5" r="1.4" fill="#4ade80" />}
        </svg>
      );
    }
    case 'building_plan':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <rect x="4" y="5" width="16" height="14" rx="1.5" fill="#1d4ed8" stroke="#16181c" strokeWidth="1.7" />
          <path d="M7 9H17M7 12H15M7 15H12" stroke="#bfdbfe" strokeWidth="1.4" strokeLinecap="round" />
          <rect x="13" y="12" width="4" height="4" fill="none" stroke="#93c5fd" strokeWidth="1.2" />
        </svg>
      );
    case 'hammer':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <path d="M6 20L14 10" stroke="#16181c" strokeWidth="4.2" strokeLinecap="round" />
          <path d="M6 20L14 10" stroke="#9a6b3e" strokeWidth="2.2" strokeLinecap="round" />
          <path
            d="M11 5L19 10L17 13L9 8Z"
            fill="#64748b"
            stroke="#16181c"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'bow':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <path
            d="M7 4C14 6 17 10 17 12C17 14 14 18 7 20"
            fill="none"
            stroke="#9a6b3e"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <line x1="7" y1="4" x2="7" y2="20" stroke="#e5dfd3" strokeWidth="1.1" />
          <path d="M5 12H20M17 9.5L20 12L17 14.5" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      );
    case 'crossbow':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <path d="M4 18L19 5" stroke="#9a6b3e" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M9 6C13 8 16 11 18 15" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="9" y1="6" x2="18" y2="15" stroke="#e5dfd3" strokeWidth="1" />
        </svg>
      );
    case 'arrow':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <path d="M5 19L18 6" stroke="#9a6b3e" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M14 5L19 5L19 10Z" fill="#cbd5e1" stroke="#16181c" strokeWidth="1.2" />
          <path d="M5 19L4 15M5 19L9 20" stroke="#ef4444" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'pipe_shotgun':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <path d="M3 16L8 13L10 15L6 19Z" fill="#8b5a2b" stroke="#16181c" strokeWidth="1.4" />
          <path d="M8 12L20 6L21.5 8.5L9.5 14.5Z" fill="#64748b" stroke="#16181c" strokeWidth="1.5" />
          <line x1="14" y1="9" x2="15.5" y2="11.5" stroke="#c2410c" strokeWidth="1.8" />
        </svg>
      );
    case 'revolver':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <path d="M5 19L8 12L11 13L8.5 20Z" fill="#8b5a2b" stroke="#16181c" strokeWidth="1.4" />
          <rect x="8" y="8" width="12" height="4" rx="0.8" fill="#64748b" stroke="#16181c" strokeWidth="1.4" />
          <rect x="9.5" y="11.5" width="4.5" height="3" rx="0.5" fill="#475569" stroke="#16181c" strokeWidth="1.2" />
        </svg>
      );
    case 'smg':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <rect x="4" y="8" width="14" height="4.5" rx="1" fill="#475569" stroke="#16181c" strokeWidth="1.4" />
          <rect x="18" y="9" width="4" height="2" fill="#94a3b8" stroke="#16181c" strokeWidth="1.1" />
          <path d="M9.5 12.5L12.5 12.5L11.5 19L8.5 19Z" fill="#7c2d12" stroke="#16181c" strokeWidth="1.3" />
          <circle cx="15" cy="10.2" r="1.2" fill="#4ade80" />
        </svg>
      );
    case 'sniper_rifle':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <path d="M2 16L7 12.5L9.5 14L5.5 18Z" fill="#7c5633" stroke="#16181c" strokeWidth="1.3" />
          <path d="M7.5 12L19 5.5L20 7.2L8.8 13.8Z" fill="#475569" stroke="#16181c" strokeWidth="1.3" />
          <path d="M18.5 5.8L22 3.8" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" />
          <rect
            x="9.5"
            y="6.2"
            width="6"
            height="2.4"
            rx="0.7"
            transform="rotate(-29 12.5 7.4)"
            fill="#1e293b"
            stroke="#4ade80"
            strokeWidth="1"
          />
        </svg>
      );
    case 'burlap_hood':
    case 'wood_helmet':
    case 'sludge_helmet': {
      const fill =
        id === 'sludge_helmet' ? '#1f4a33' : id === 'wood_helmet' ? '#8b5a2b' : '#b89f7d';
      const trim =
        id === 'sludge_helmet' ? '#4ade80' : id === 'wood_helmet' ? '#94a3b8' : '#786245';
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <path
            d="M5 14C5 8.5 8 5 12 5C16 5 19 8.5 19 14V18H15V14.5H9V18H5Z"
            fill={fill}
            stroke="#16181c"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M7 11.5H17" stroke={trim} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    }
    case 'burlap_vest':
    case 'wood_chestplate':
    case 'sludge_armor': {
      const fill =
        id === 'sludge_armor' ? '#1e3a2c' : id === 'wood_chestplate' ? '#8b5a2b' : '#b89f7d';
      const trim =
        id === 'sludge_armor' ? '#4ade80' : id === 'wood_chestplate' ? '#cbd5e1' : '#786245';
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <path
            d="M7 4L10 4L12 6.5L14 4L17 4L20 8L18 11L17 10V20H7V10L6 11L4 8Z"
            fill={fill}
            stroke="#16181c"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M9 11H15M9 15H15" stroke={trim} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    }
    case 'burlap_pants':
    case 'wood_greaves':
    case 'sludge_greaves': {
      const fill =
        id === 'sludge_greaves' ? '#1e3a2c' : id === 'wood_greaves' ? '#8b5a2b' : '#b89f7d';
      const trim =
        id === 'sludge_greaves' ? '#4ade80' : id === 'wood_greaves' ? '#cbd5e1' : '#786245';
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <path
            d="M7 4H17L18 20H13.5L12 11.5L10.5 20H6Z"
            fill={fill}
            stroke="#16181c"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M7.5 8.5H16.5" stroke={trim} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    }
    case 'ammo':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <rect x="6" y="7" width="4.5" height="12" rx="1" fill="#b91c1c" stroke="#16181c" strokeWidth="1.3" />
          <rect x="6" y="15" width="4.5" height="4" fill="#d97706" stroke="#16181c" strokeWidth="1.2" />
          <rect x="13" y="6" width="4.5" height="13" rx="1" fill="#b91c1c" stroke="#16181c" strokeWidth="1.3" />
          <rect x="13" y="15" width="4.5" height="4" fill="#d97706" stroke="#16181c" strokeWidth="1.2" />
        </svg>
      );
    case 'grenade':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <rect x="7" y="7" width="10" height="13" rx="3" fill="#475569" stroke="#16181c" strokeWidth="1.5" />
          <rect x="7.5" y="11" width="9" height="4.5" fill="#4ade80" stroke="#16181c" strokeWidth="1.1" />
          <path d="M10 7V4H14V7M14 5L17 6" stroke="#d97706" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        </svg>
      );
    case 'cooked_meat':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <path
            d="M5 14C5 9 9 6 14 6C18 6 20 8.5 19.5 12C19 16 14 18 9 18C6.5 18 5 16.2 5 14Z"
            fill="#a14228"
            stroke="#16181c"
            strokeWidth="1.6"
          />
          <circle cx="15" cy="10.5" r="2.2" fill="#e5dfd3" stroke="#16181c" strokeWidth="1.2" />
        </svg>
      );
    case 'raw_meat':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <path
            d="M5 14C5 9 9 6 14 6C18 6 20 8.5 19.5 12C19 16 14 18 9 18C6.5 18 5 16.2 5 14Z"
            fill="#dc2626"
            stroke="#16181c"
            strokeWidth="1.6"
          />
          <circle cx="15" cy="10.5" r="2.2" fill="#fecaca" stroke="#16181c" strokeWidth="1.2" />
        </svg>
      );
    case 'berries':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <path d="M8 7L12 4L16 7" stroke="#4d7c0f" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <circle cx="9" cy="13" r="3.4" fill="#dc2626" stroke="#16181c" strokeWidth="1.3" />
          <circle cx="15" cy="13" r="3.4" fill="#ef4444" stroke="#16181c" strokeWidth="1.3" />
          <circle cx="12" cy="17" r="3.2" fill="#b91c1c" stroke="#16181c" strokeWidth="1.3" />
        </svg>
      );
    case 'medkit':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <rect x="4" y="7" width="16" height="12" rx="2" fill="#e5e7eb" stroke="#16181c" strokeWidth="1.5" />
          <path d="M9 7V5H15V7" stroke="#64748b" strokeWidth="1.5" fill="none" />
          <path d="M12 10V16M9 13H15" stroke="#dc2626" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );
    case 'sludge_stim':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <path d="M5 19L9 15" stroke="#cbd5e1" strokeWidth="1.6" strokeLinecap="round" />
          <rect x="9" y="8" width="9" height="4.5" rx="1" transform="rotate(-45 13 11)" fill="#4ade80" stroke="#16181c" strokeWidth="1.4" />
          <path d="M16 5L19 8" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case 'door_item':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <rect x="6" y="3" width="12" height="18" rx="1" fill="#9a6b3e" stroke="#16181c" strokeWidth="1.6" />
          <line x1="10" y1="3" x2="10" y2="21" stroke="#5c3d21" strokeWidth="1.2" />
          <line x1="14" y1="3" x2="14" y2="21" stroke="#5c3d21" strokeWidth="1.2" />
          <circle cx="15.5" cy="12" r="1.3" fill="#cbd5e1" />
        </svg>
      );
    case 'campfire_item':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <path
            d="M12 3C15.5 7 17 10.5 14.5 14C13.5 15.4 10.5 15.4 9.5 14C7 10.5 8.5 7 12 3Z"
            fill="#f97316"
            stroke="#16181c"
            strokeWidth="1.4"
          />
          <path d="M12 7C13.5 9.2 13.8 11.2 12 12.8C10.2 11.2 10.5 9.2 12 7Z" fill="#fde047" />
          <path d="M5 18L19 15M5 15L19 18" stroke="#784c26" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      );
    case 'lantern_item':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <path d="M9 6C9 4 15 4 15 6" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
          <rect x="7" y="7" width="10" height="11" rx="1.5" fill="#475569" stroke="#16181c" strokeWidth="1.4" />
          <rect x="9" y="9" width="6" height="7" rx="0.8" fill="#4ade80" />
          <rect x="6" y="18" width="12" height="2.5" rx="0.8" fill="#334155" stroke="#16181c" strokeWidth="1.2" />
        </svg>
      );
    case 'floodlight_item':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <path d="M12 10V20M8 20L12 14L16 20" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          <rect x="4" y="5" width="7" height="5" rx="1" fill="#334155" stroke="#16181c" strokeWidth="1.3" />
          <rect x="13" y="5" width="7" height="5" rx="1" fill="#334155" stroke="#16181c" strokeWidth="1.3" />
          <rect x="5.2" y="6.2" width="4.6" height="2.6" fill="#bef264" />
          <rect x="14.2" y="6.2" width="4.6" height="2.6" fill="#bef264" />
          <line x1="8" y1="10" x2="16" y2="10" stroke="#d97706" strokeWidth="1.8" />
        </svg>
      );
    case 'barricade_item':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <path d="M5 19L9 6M12 19L12 5M19 19L15 6" stroke="#9a6b3e" strokeWidth="2.6" strokeLinecap="round" />
          <rect x="4" y="13" width="16" height="3" fill="#7c5633" stroke="#16181c" strokeWidth="1.2" />
        </svg>
      );
    case 'bed_item':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <path d="M4 18V8M20 18V11M4 15H20" stroke="#8b5a2b" strokeWidth="2.2" strokeLinecap="round" />
          <rect x="5" y="11" width="14" height="4" rx="1" fill="#15803d" stroke="#16181c" strokeWidth="1.3" />
          <rect x="5.5" y="8.5" width="4.5" height="2.8" rx="0.8" fill="#e5dfd3" stroke="#16181c" strokeWidth="1.2" />
        </svg>
      );
    case 'barrel_item':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <rect x="6" y="4" width="12" height="16" rx="1.5" fill="#b91c1c" stroke="#16181c" strokeWidth="1.6" />
          <rect x="5.5" y="9" width="13" height="5" fill="#f59e0b" stroke="#16181c" strokeWidth="1.2" />
          <line x1="6" y1="6.5" x2="18" y2="6.5" stroke="#374151" strokeWidth="1.6" />
          <line x1="6" y1="17.5" x2="18" y2="17.5" stroke="#374151" strokeWidth="1.6" />
        </svg>
      );
    case 'chest_item':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <rect x="3.5" y="7" width="17" height="12.5" rx="1.5" fill="#8b5a2b" stroke="#16181c" strokeWidth="1.6" />
          <path d="M3.5 11.5H20.5" stroke="#16181c" strokeWidth="1.5" />
          <rect x="6.5" y="7" width="2" height="12.5" fill="#475569" stroke="#16181c" strokeWidth="1" />
          <rect x="15.5" y="7" width="2" height="12.5" fill="#475569" stroke="#16181c" strokeWidth="1" />
          <rect x="10.6" y="10" width="2.8" height="3.2" rx="0.6" fill="#d97706" stroke="#16181c" strokeWidth="1.1" />
        </svg>
      );
    case 'fishing_rod':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <path d="M4 20L17 4" stroke="#8b5a2b" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M17 4C19 7 19 12 18 16" fill="none" stroke="#cbd5e1" strokeWidth="1.2" />
          <circle cx="18" cy="17.5" r="2.2" fill="#ef4444" stroke="#16181c" strokeWidth="1.2" />
          <circle cx="7.5" cy="15.5" r="1.8" fill="#64748b" stroke="#16181c" strokeWidth="1.1" />
        </svg>
      );
    case 'raw_fish':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <path
            d="M4 12L8 9C11.5 6.5 16.5 7.5 19.5 12C16.5 16.5 11.5 17.5 8 15L4 12Z"
            fill="#60a5fa"
            stroke="#16181c"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <polygon points="3,8.5 7,12 3,15.5" fill="#3b82f6" stroke="#16181c" strokeWidth="1.3" />
          <circle cx="15.8" cy="11.2" r="1.2" fill="#0f172a" />
        </svg>
      );
    case 'cooked_fish':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <path
            d="M4 12L8 9C11.5 6.5 16.5 7.5 19.5 12C16.5 16.5 11.5 17.5 8 15L4 12Z"
            fill="#d97706"
            stroke="#16181c"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <polygon points="3,8.5 7,12 3,15.5" fill="#b45309" stroke="#16181c" strokeWidth="1.3" />
          <path d="M11 9.5L10.5 14.5M14 9.5L13.5 14.5" stroke="#78350f" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="16" cy="11.2" r="1.1" fill="#1c1917" />
        </svg>
      );
    case 'wood':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <rect x="4" y="8" width="16" height="8" rx="3" fill="#8b5a2b" stroke="#16181c" strokeWidth="1.5" />
          <ellipse cx="18" cy="12" rx="2" ry="4" fill="#d4a373" stroke="#16181c" strokeWidth="1.2" />
        </svg>
      );
    case 'stone':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <polygon points="6,17 4,10 11,5 19,8 18,17" fill="#9ca3af" stroke="#16181c" strokeWidth="1.5" />
        </svg>
      );
    case 'metal_ore':
    case 'metal_frags':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <polygon points="5,16 7,7 15,5 19,12 14,19" fill="#64748b" stroke="#16181c" strokeWidth="1.5" />
          <path d="M9 10L15 8L14 14" stroke="#cbd5e1" strokeWidth="1.3" fill="none" />
        </svg>
      );
    case 'sulfur':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <polygon points="6,17 5,10 12,5 19,9 17,18" fill="#eab308" stroke="#16181c" strokeWidth="1.5" />
        </svg>
      );
    case 'cloth':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <path d="M5 7C9 5 15 9 19 7V17C15 19 9 15 5 17Z" fill="#d6cbb8" stroke="#16181c" strokeWidth="1.5" />
        </svg>
      );
    case 'sludge':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <path
            d="M12 3C15.5 8 18.5 11.5 18.5 15C18.5 18.6 15.6 21 12 21C8.4 21 5.5 18.6 5.5 15C5.5 11.5 8.5 8 12 3Z"
            fill="#22c55e"
            stroke="#16181c"
            strokeWidth="1.5"
          />
          <circle cx="10" cy="15" r="1.8" fill="#bbf7d0" />
        </svg>
      );
    case 'foundation':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <polygon points="12,5 21,10 12,15 3,10" fill="#a87c4f" stroke="#16181c" strokeWidth="1.4" />
          <polygon points="3,10 12,15 12,19 3,14" fill="#7c5633" stroke="#16181c" strokeWidth="1.4" />
          <polygon points="21,10 12,15 12,19 21,14" fill="#634326" stroke="#16181c" strokeWidth="1.4" />
        </svg>
      );
    case 'wall':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <rect x="4" y="5" width="16" height="14" fill="#a87c4f" stroke="#16181c" strokeWidth="1.5" />
          <line x1="4" y1="10" x2="20" y2="10" stroke="#5c3d21" strokeWidth="1.2" />
          <line x1="4" y1="14" x2="20" y2="14" stroke="#5c3d21" strokeWidth="1.2" />
        </svg>
      );
    case 'doorway':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <path
            d="M4 5H20V19H15V10H9V19H4Z"
            fill="#a87c4f"
            stroke="#16181c"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'window_wall':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <path
            d="M4 5H20V19H4Z M8 9V14H16V9Z"
            fill="#a87c4f"
            fillRule="evenodd"
            stroke="#16181c"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <line x1="12" y1="9" x2="12" y2="14" stroke="#16181c" strokeWidth="1.4" />
        </svg>
      );
    case 'floor':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <polygon points="12,7 21,12 12,17 3,12" fill="#b8895a" stroke="#16181c" strokeWidth="1.5" />
        </svg>
      );
    case 'stairs':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
          <path
            d="M4 19H20V6H15V10H11V14H7V19Z"
            fill="#a87c4f"
            stroke="#16181c"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
};
