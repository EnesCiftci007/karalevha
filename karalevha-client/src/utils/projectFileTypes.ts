import { api } from '../services/api';
import { MODEL_FORMATS } from './loadModel';

/** Projenin dosya bölümleri (3B modeller ayrı: PrintModels) */
export type FileKind = 'cizim' | 'elektronik' | 'kod';
export type PartKind = FileKind | 'model';

export interface FileTypes {
  common: string[];
  cizim: string[];
  elektronik: string[];
  kod: string[];
}

export const KIND_LABEL: Record<PartKind, string> = {
  model: '3B model',
  cizim: 'Çizim / CAD',
  elektronik: 'Elektronik',
  kod: 'Kod',
};

/** Kullanıcıya gösterilen kısa format özeti */
export const KIND_FORMATS: Record<PartKind, string> = {
  model: 'STL, 3MF, OBJ, FBX, GLB (sitede 3B görüntülenir)',
  cizim: 'STEP, IGES, DXF, DWG, SVG, Fusion 360, SolidWorks, Inventor, FreeCAD, URDF',
  elektronik: 'KiCad, Eagle, Altium, Fritzing, Proteus, LTspice, Gerber',
  kod: '.ino, .c/.cpp, .py, .ipynb, MATLAB, Verilog/VHDL, ROS',
};

let cached: Promise<FileTypes> | null = null;

/** Sunucunun kabul ettiği uzantılar (tek kaynak API'de: ProjectFileTypes) */
export function loadFileTypes(): Promise<FileTypes> {
  cached ??= api<FileTypes>('/api/projects/dosya-turleri').catch((err) => {
    cached = null;
    throw err;
  });
  return cached;
}

export const extOf = (name: string) => (name.includes('.') ? name.slice(name.lastIndexOf('.')).toLowerCase() : '');

/** Bir bölümün dosya seçicisi için accept listesi */
export const acceptOf = (types: FileTypes, kind: PartKind) =>
  kind === 'model' ? MODEL_FORMATS.map((f) => `.${f}`).join(',') : [...types[kind], ...types.common].join(',');

/**
 * Dosyanın hangi bölüme gideceği, uzantısına göre. Görsel, PDF, ZIP gibi her bölüme uyanlar için
 * öneri "cizim"dir; kullanıcı değiştirebilir. Hiçbir bölüme uymuyorsa null.
 */
export function classify(types: FileTypes, name: string): PartKind | null {
  const ext = extOf(name);
  if ((MODEL_FORMATS as readonly string[]).includes(ext.slice(1))) return 'model';
  // .json hem EasyEDA hem kod olabilir: önce kod
  if (types.kod.includes(ext)) return 'kod';
  if (types.elektronik.includes(ext)) return 'elektronik';
  if (types.cizim.includes(ext)) return 'cizim';
  if (types.common.includes(ext)) return 'cizim';
  return null;
}

/** Bu dosya seçilen bölüme eklenebilir mi */
export function fits(types: FileTypes, name: string, kind: PartKind): boolean {
  const ext = extOf(name);
  if (kind === 'model') return (MODEL_FORMATS as readonly string[]).includes(ext.slice(1));
  return types[kind].includes(ext) || types.common.includes(ext);
}
