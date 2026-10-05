export interface User {
  id: number;
  username: string;
  email: string;
  avatarSeed: string;
}

export interface Post {
  id: number;
  content: string;
  createdAt: string;
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
}

export interface PrintModel {
  id: number;
  title: string;
  description: string;
  fileUrl: string;
  uploadedAt: string;
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
