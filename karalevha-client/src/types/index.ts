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
}

export interface Project {
  id: number;
  title: string;
  description: string;
  repoUrl: string;
  stars: number;
  forks: number;
  createdAt: string;
  owner: string;
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
