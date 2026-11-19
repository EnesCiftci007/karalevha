export interface User {
  id: number;
  username: string;
  email: string;
  avatarSeed: string;
  isAdmin?: boolean;
  role?: 'User' | 'Admin' | 'Owner';
  /** Doluysa hesap bu ana kadar askıda: okuyabilir, yazamaz */
  bannedUntil?: string | null;
}

/** Gönderi etiketleri ve ilgi alanları (sunucudaki PostTags.All ile aynı) */
export const POST_TAGS = ['Yazılım', 'Robotik', '3B Baskı', 'Elektronik', 'El İşi', 'Tasarım', 'Oyun Geliştirme', 'IoT', 'Duyuru'] as const;

export interface Post {
  id: number;
  content: string;
  createdAt: string;
  editedAt?: string | null;
  tags?: string[];
  user: { id: number; username: string; avatarSeed: string; };
}

export interface Oba {
  id: number;
  name: string;
  description: string;
  color: string;
  avatarSeed: string;
  createdAt: string;
  owner: string;
  isPrivate?: boolean;
  /** Listede görünmez, yalnızca davetle girilir */
  isUnlisted?: boolean;
  memberCount?: number;
  /** Giriş yapan kişi kurucu ya da üye mi */
  isMember?: boolean;
  messageCount?: number;
  lastMessageAt?: string | null;
}

export interface PrintModel {
  id: number;
  title: string;
  description: string;
  fileUrl: string;
  category: 'baski' | 'oyun';
  format: 'stl' | '3mf' | 'obj' | 'fbx' | 'glb';
  uploadedAt: string;
  userId: number;
  uploader: string;
  /** Modelin ait olduğu proje */
  projectId?: number | null;
  projectTitle?: string | null;
  /** Kaçıncı sürüm ve değişiklik notu (eskileri sürüm geçmişinde) */
  version?: number;
  versionNote?: string | null;
}

export interface Project {
  id: number;
  title: string;
  description: string;
  /** Boşsa projenin yazılım deposu yok (yalnızca donanım/tasarım) */
  repoUrl: string;
  stars: number;
  forks: number;
  createdAt: string;
  owner: string;
  userId?: number;
  /** Ekip üyeleri (sahip hariç) */
  memberIds?: number[];
  modelCount?: number;
  fileCount?: number;
  drawingCount?: number;
  electronicsCount?: number;
  codeFileCount?: number;
  /** Dal: robotik, elektronik, yazilim, tasarim, diger */
  category?: string;
  /** Listede önizleme olarak gösterilen ilk 3B model */
  cover?: { id: number; fileUrl: string; fileName: string } | null;
}

/** Projenin çizim ve belgeleri (şema, teknik çizim, PCB, fotoğraf, PDF) */
export interface ProjectFile {
  id: number;
  title: string;
  fileName: string;
  fileUrl: string;
  contentType: string;
  /** Bölüm: cizim (mekanik/CAD), elektronik, kod */
  kind?: 'cizim' | 'elektronik' | 'kod';
  version?: number;
  versionNote?: string | null;
  size: number;
  uploadedAt: string;
  userId: number;
  uploader: string;
}

export interface MarketService {
  id: 'cnc' | 'lazer' | 'baski' | 'pcb';
  name: string;
  description: string;
  materials: string[];
  extensions: string[];
  hint: string;
}

export type MarketStatus = 'alindi' | 'fiyatlandi' | 'onaylandi' | 'uretimde' | 'hazir' | 'teslim' | 'iptal';

export interface MarketOrder {
  id: number;
  service: MarketService['id'];
  serviceName: string;
  material: string;
  quantity: number;
  dimensions?: string | null;
  note?: string | null;
  fileName: string;
  fileSize: number;
  /** Projedeki bir model/dosyadan verildiyse */
  projectId?: number | null;
  sourceLabel?: string | null;
  status: MarketStatus;
  statusLabel: string;
  price?: number | null;
  staffNote?: string | null;
  createdAt: string;
  updatedAt: string;
  userId: number;
  username: string;
}

export interface Equipment {
  id: number;
  name: string;
  kind: 'yazici' | 'lehim' | 'lazer' | 'diger';
  description?: string | null;
  status: 'hazir' | 'bakimda';
  inUse: boolean;
}

export interface Reservation {
  id: number;
  equipmentId: number;
  equipmentName: string;
  startsAt: string;
  endsAt: string;
  note?: string | null;
  userId: number;
  username: string;
  printModelId?: number | null;
  printModelTitle?: string | null;
}

export interface ClubEvent {
  id: number;
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: string;
  endsAt?: string | null;
  createdById: number;
  createdBy: string;
  attendeeCount: number;
  attending: boolean;
  attendees: string[];
}

export interface PrintMake {
  id: number;
  printModelId: number;
  photoPath: string;
  note?: string | null;
  settings?: string | null;
  createdAt: string;
  userId: number;
  username: string;
}

export interface CommentItem {
  id: number;
  content: string;
  createdAt: string;
  userId: number;
  username: string;
  /** Yanıtsa ana yorum (tek seviye) */
  parentId?: number | null;
  likes: number;
  liked: boolean;
}

export interface SocialCounts {
  likes: number;
  liked: boolean;
  comments: number;
}

export interface NotificationItem {
  id: number;
  text: string;
  link: string;
  isRead: boolean;
  createdAt: string;
  actor?: string | null;
}
