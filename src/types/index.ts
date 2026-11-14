export type UserRole = 'viewer' | 'user' | 'admin'

export type TreeKey =
  | 'vitalidade'
  | 'resistencia'
  | 'movimento'
  | 'ataque'
  | 'mente'
  | 'magia'
  | 'sentido'
  | 'alma'
  | 'supremas'

export interface TalentTree {
  key: TreeKey
  name: string
  description: string
  icon: string
  accent: string
}

export interface CharacterProgress {
  level: number
  pointsAvailable: number
  pointsDistributed: number
}
