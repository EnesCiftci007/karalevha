import * as THREE from 'three';
import type { CadRequest, CadResponse } from './cad.worker';

/**
 * STEP / IGES dosyasını indirir, iş parçacığında okutur ve three.js nesnesine çevirir.
 * CAD'deki parça ve yüz renkleri korunur; rengi olmayan parçalar varsayılan renkle boyanır.
 */
export async function loadCad(url: string, format: 'step' | 'iges', color: string): Promise<THREE.Object3D> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Dosya indirilemedi.');
  const buffer = await res.arrayBuffer();

  const worker = new Worker(new URL('./cad.worker.ts', import.meta.url), { type: 'module' });
  const response = await new Promise<CadResponse>((resolve) => {
    worker.onmessage = (ev: MessageEvent<CadResponse>) => resolve(ev.data);
    worker.onerror = () => resolve({ ok: false, error: 'CAD okuyucu yüklenemedi.' });
    worker.postMessage({ format, buffer } satisfies CadRequest, [buffer]);
  }).finally(() => worker.terminate());
  if (!response.ok) throw new Error(response.error);

  const group = new THREE.Group();
  const fallback = new THREE.Color(color);
  for (const m of response.meshes) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(m.position, 3));
    if (m.normal) geometry.setAttribute('normal', new THREE.BufferAttribute(m.normal, 3));
    geometry.setIndex(new THREE.BufferAttribute(m.index, 1));
    if (!m.normal) geometry.computeVertexNormals();

    const base = m.color ? new THREE.Color(...m.color) : fallback;
    const make = (c: THREE.Color) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.1, side: THREE.DoubleSide });

    // Yüzlerin kendi rengi varsa her renk ayrı malzeme grubu olur
    const colored = m.faces.some((f) => f.color);
    let material: THREE.Material | THREE.Material[] = make(base);
    if (colored) {
      const materials: THREE.Material[] = [make(base)];
      const byKey = new Map<string, number>();
      for (const f of m.faces) {
        let slot = 0;
        if (f.color) {
          const key = f.color.join(',');
          if (!byKey.has(key)) {
            byKey.set(key, materials.length);
            materials.push(make(new THREE.Color(...f.color)));
          }
          slot = byKey.get(key)!;
        }
        geometry.addGroup(f.first * 3, (f.last - f.first + 1) * 3, slot);
      }
      material = materials;
    }
    const mesh = new THREE.Mesh(geometry, material);
    if (m.name) mesh.name = m.name;
    group.add(mesh);
  }
  return group;
}
