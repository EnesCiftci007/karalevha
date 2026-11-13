import * as THREE from 'three';

/** Sitenin kabul ettiği 3B biçimler (backend'deki listeyle aynı). */
export const MODEL_FORMATS = ['stl', '3mf', 'obj', 'fbx', 'glb'] as const;
export type ModelFormat = (typeof MODEL_FORMATS)[number];

export const MODEL_ACCEPT = MODEL_FORMATS.map((f) => `.${f}`).join(',');

export function formatOf(fileName: string): ModelFormat | null {
  const ext = fileName.split('.').pop()?.toLowerCase();
  return (MODEL_FORMATS as readonly string[]).includes(ext ?? '') ? (ext as ModelFormat) : null;
}

/** Oyun motorlarının biçimleri; yüklerken kategori önerisi için. */
export const GAME_FORMATS: ModelFormat[] = ['fbx', 'glb'];

export interface LoadedModel {
  /** Merkeze alınmış, tabla üzerinde (y = 0) duran model */
  object: THREE.Object3D;
  /** Modelin en büyük boyutu (kamera mesafesi için) */
  size: number;
  /** FBX / GLB içindeki animasyonlar */
  animations: THREE.AnimationClip[];
  /** Kendi malzemesi yoksa (STL, OBJ) bizim malzememiz kullanıldı mı */
  plain: boolean;
}

const plainMaterial = (color: string) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05 });

/**
 * Bir model dosyasını biçimine göre yükler. Yükleyiciler gerektiğinde ayrı parça olarak
 * indirilir; STL sayfası FBX kodunu, FBX sayfası glTF kodunu taşımaz.
 */
export async function loadModel(url: string, format: ModelFormat, color = '#d8d3c6'): Promise<LoadedModel> {
  let object: THREE.Object3D;
  let animations: THREE.AnimationClip[] = [];
  let plain = false;
  // STL ve 3MF baskı dünyasından gelir: yukarı yön Z. Sahnede yukarı Y.
  let zUp = false;

  switch (format) {
    case 'stl': {
      const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
      const geometry = await new STLLoader().loadAsync(url);
      geometry.computeVertexNormals();
      object = new THREE.Mesh(geometry, plainMaterial(color));
      plain = true;
      zUp = true;
      break;
    }
    case '3mf': {
      const { ThreeMFLoader } = await import('three/examples/jsm/loaders/3MFLoader.js');
      object = await new ThreeMFLoader().loadAsync(url);
      zUp = true;
      break;
    }
    case 'obj': {
      const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
      object = await new OBJLoader().loadAsync(url);
      // OBJ'nin malzeme dosyası (.mtl) ayrı durur ve yüklenmez; düz malzeme ver
      object.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) (child as THREE.Mesh).material = plainMaterial(color);
      });
      plain = true;
      break;
    }
    case 'fbx': {
      const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
      const group = await new FBXLoader().loadAsync(url);
      animations = group.animations;
      object = group;
      break;
    }
    case 'glb': {
      const [{ GLTFLoader }, { DRACOLoader }, wrapper, wasm] = await Promise.all([
        import('three/examples/jsm/loaders/GLTFLoader.js'),
        import('three/examples/jsm/loaders/DRACOLoader.js'),
        import('three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js?url'),
        import('three/examples/jsm/libs/draco/gltf/draco_decoder.wasm?url'),
      ]);
      const draco = new DRACOLoader().setDecoderPath({ js: wrapper.default, wasm: wasm.default });
      const loader = new GLTFLoader().setDRACOLoader(draco);
      try {
        const gltf = await loader.loadAsync(url);
        object = gltf.scene;
        animations = gltf.animations;
      } finally {
        draco.dispose();
      }
      break;
    }
  }

  // Yönü düzelt, merkeze al, tablaya oturt
  const wrapper = new THREE.Group();
  if (zUp) object.rotation.x = -Math.PI / 2;
  wrapper.add(object);
  wrapper.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(wrapper, true);
  if (box.isEmpty()) throw new Error('Model boş ya da okunamadı.');
  const center = box.getCenter(new THREE.Vector3());
  object.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));

  const size = box.getSize(new THREE.Vector3());
  return { object: wrapper, size: Math.max(size.x, size.y, size.z) || 1, animations, plain };
}

/** Sahnedeki modelin bütün geometri, malzeme ve dokularını serbest bırakır. */
export function disposeObject(root: THREE.Object3D) {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!material) continue;
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) value.dispose();
      }
      material.dispose();
    }
  });
}
