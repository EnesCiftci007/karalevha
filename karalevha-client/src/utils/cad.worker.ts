/// <reference lib="webworker" />
/**
 * STEP ve IGES dosyalarını (OpenCascade, WebAssembly) ayrı bir iş parçacığında üçgen ağına çevirir:
 * büyük montajlar okunurken sayfa donmaz. Okuyucu (~7 MB) yalnızca bir CAD dosyası açıldığında iner.
 */
import occtimportjs from 'occt-import-js';
import wasmUrl from 'occt-import-js/dist/occt-import-js.wasm?url';

export interface CadMesh {
  name?: string;
  color?: [number, number, number];
  position: Float32Array;
  normal?: Float32Array;
  index: Uint32Array;
  /** Yüz renkleri: [ilk üçgen, son üçgen, renk] */
  faces: { first: number; last: number; color: [number, number, number] | null }[];
}

export type CadRequest = { format: 'step' | 'iges'; buffer: ArrayBuffer };
export type CadResponse = { ok: true; meshes: CadMesh[] } | { ok: false; error: string };

interface OcctMesh {
  name?: string;
  color?: [number, number, number];
  attributes: { position: { array: number[] }; normal?: { array: number[] } };
  index: { array: number[] };
  brep_faces?: { first: number; last: number; color: [number, number, number] | null }[];
}

let occt: Promise<{ ReadFile: (format: string, data: Uint8Array, params: unknown) => { success: boolean; meshes: OcctMesh[] } }> | null = null;

self.onmessage = async (ev: MessageEvent<CadRequest>) => {
  try {
    occt ??= occtimportjs({ locateFile: () => wasmUrl });
    const lib = await occt;
    const result = lib.ReadFile(ev.data.format, new Uint8Array(ev.data.buffer), null);
    if (!result.success || !result.meshes?.length) {
      postMessage({ ok: false, error: 'Dosya okunamadı ya da içinde katı model yok.' } satisfies CadResponse);
      return;
    }
    const meshes: CadMesh[] = result.meshes.map((m) => ({
      name: m.name,
      color: m.color,
      position: new Float32Array(m.attributes.position.array),
      normal: m.attributes.normal ? new Float32Array(m.attributes.normal.array) : undefined,
      index: new Uint32Array(m.index.array),
      faces: m.brep_faces ?? [],
    }));
    const transfer = meshes.flatMap((m) => [m.position.buffer, m.index.buffer, ...(m.normal ? [m.normal.buffer] : [])]);
    (self as unknown as DedicatedWorkerGlobalScope).postMessage({ ok: true, meshes } satisfies CadResponse, transfer);
  } catch (err) {
    postMessage({ ok: false, error: err instanceof Error ? err.message : 'CAD okuyucu çalışmadı.' } satisfies CadResponse);
  }
};
