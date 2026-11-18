import { Bot, Box, Code2, Cpu, Shapes, type LucideIcon } from 'lucide-react';

/** Projelerin dalları (API: ProjectsController.Categories ile aynı sıra) */
export const PROJECT_CATEGORIES = [
  { id: 'robotik', label: 'Robotik', icon: Bot, hint: 'Kod, model ve devresi bir arada robotlar ve mekanizmalar' },
  { id: 'elektronik', label: 'Elektronik', icon: Cpu, hint: 'Devre, PCB ve gömülü sistemler' },
  { id: 'yazilim', label: 'Yazılım', icon: Code2, hint: 'Yalnızca yazılım: uygulama, kütüphane, analiz' },
  { id: 'tasarim', label: '3B tasarım', icon: Box, hint: 'Basılacak ya da işlenecek modeller' },
  { id: 'diger', label: 'Diğer', icon: Shapes, hint: 'Başka bir dala girmeyenler' },
] as const satisfies readonly { id: string; label: string; icon: LucideIcon; hint: string }[];

export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number]['id'];

export const categoryOf = (id: string | null | undefined) =>
  PROJECT_CATEGORIES.find((c) => c.id === id) ?? PROJECT_CATEGORIES[PROJECT_CATEGORIES.length - 1];
