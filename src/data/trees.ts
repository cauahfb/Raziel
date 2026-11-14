
import {
  Brain,
  Eye,
  Flame,
  Footprints,
  HeartPulse,
  Shield,
  Sparkles,
  Swords,
} from 'lucide-react'

import type { Tree } from '../types/tree'

export const trees: Tree[] = [
  {
    id: 'vitalidade',
    name: 'Vitalidade',
    subtitle: 'Resiliência, recuperação e vigor físico',
    icon: HeartPulse,
    points: 0,
    color: 'blue',
    visible: 0,
  },
  {
    id: 'resistencia',
    name: 'Resistência',
    subtitle: 'A capacidade de suportar o impossível',
    icon: Shield,
    points: 0,
    color: 'slate',
    visible: 0,
  },
  {
    id: 'movimento',
    name: 'Movimento',
    subtitle: 'Mobilidade, agilidade e domínio do espaço',
    icon: Footprints,
    points: 0,
    color: 'teal',
    visible: 0,
  },
  {
    id: 'ataque',
    name: 'Ataque',
    subtitle: 'Aprimoramento das capacidades ofensivas',
    icon: Swords,
    points: 0,
    color: 'gold',
    visible: 0,
  },
  {
    id: 'mente',
    name: 'Mente',
    subtitle: 'Intelecto, memória e estratégia',
    icon: Brain,
    points: 0,
    color: 'violet',
    visible: 0,
  },
  {
    id: 'magia',
    name: 'Magia',
    subtitle: 'Percepção e domínio da Trama',
    icon: Sparkles,
    points: 0,
    color: 'blue',
    visible: 0,
  },
  {
    id: 'sentido',
    name: 'Sentido',
    subtitle: 'A percepção além dos limites naturais',
    icon: Eye,
    points: 0,
    color: 'teal',
    visible: 0,
  },
  {
    id: 'alma',
    name: 'Alma',
    subtitle: 'A essência que transcende o corpo',
    icon: Flame,
    points: 0,
    color: 'violet',
    visible: 0,
  },
]

export const POINTS_PER_LEVEL = 3
