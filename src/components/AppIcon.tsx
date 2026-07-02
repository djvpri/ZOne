'use client'
// Ikon ekosistem Zomet — Bootstrap Icons (https://icons.getbootstrap.com)
// via react-bootstrap-icons (per-ikon, tree-shakeable).
//
// Kolom `icon` di tabel App berisi NAMA ikon bootstrap (mis. "bus-front").
// Fallback: kalau nama tidak dikenal (mis. masih emoji lama di DB),
// string dirender apa adanya — backward compatible tanpa migrasi paksa.
import {
  Shop, Gem, CupHot, WrenchAdjustable, HeartPulse, HouseDoor,
  ClipboardCheck, PersonBoundingBox, Basket3, BusFront, Scissors,
  People, CalendarCheck, CashCoin, ShieldLock, GraphUp, Hospital,
  RocketTakeoff, BoxSeam, Cpu, QrCode, Bank, Grid, PersonBadge,
  QuestionCircle, Activity, Trophy,
} from 'react-bootstrap-icons'
import type { ComponentType } from 'react'

const ICONS: Record<string, ComponentType<{ size?: number; className?: string; color?: string }>> = {
  'shop': Shop,
  'gem': Gem,
  'cup-hot': CupHot,
  'wrench-adjustable': WrenchAdjustable,
  'heart-pulse': HeartPulse,
  'house-door': HouseDoor,
  'clipboard-check': ClipboardCheck,
  'person-bounding-box': PersonBoundingBox,
  'basket3': Basket3,
  'bus-front': BusFront,
  'scissors': Scissors,
  'people': People,
  'calendar-check': CalendarCheck,
  'cash-coin': CashCoin,
  'shield-lock': ShieldLock,
  'graph-up': GraphUp,
  'hospital': Hospital,
  'rocket-takeoff': RocketTakeoff,
  'box-seam': BoxSeam,
  'cpu': Cpu,
  'qr-code': QrCode,
  'bank': Bank,
  'grid': Grid,
  'person-badge': PersonBadge,
  'activity': Activity,
  'trophy': Trophy,
}

export default function AppIcon({ name, size = 24, color, className }: {
  name?: string | null; size?: number; color?: string; className?: string
}) {
  const key = (name || '').trim().toLowerCase()
  const Icon = ICONS[key]
  if (Icon) return <Icon size={size} color={color} className={className} />
  // Emoji lama dari DB yang belum di-seed ulang: render apa adanya (backward compatible)
  if (name && /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(name)) {
    return <span style={{ fontSize: size * 0.9, lineHeight: 1 }} className={className}>{name}</span>
  }
  return <QuestionCircle size={size} color={color} className={className} />
}

export const ICON_NAMES = Object.keys(ICONS)
