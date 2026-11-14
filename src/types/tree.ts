
import type { LucideIcon } from 'lucide-react'

export type Tree = {
  id: string
  name: string
  subtitle: string
  icon: LucideIcon
  points: number
  color: string
  visible: number
}

export type PageKey =
  | 'dashboard'
  | 'supremas'
  | 'history'
  | 'backup'
  | string
