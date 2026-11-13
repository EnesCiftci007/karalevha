import * as THREE from 'three';
import { disposeObject, loadModel, type ModelFormat } from './loadModel';

const MAX_BYTES = 15 * 1024 * 1024; // Daha büyük modeller sırf küçük resim için indirilmez
const WIDTH = 480;
const HEIGHT = 360;

const cache = new Map<string, Promise<string | null>>();
let queue: Promise<unknown> = Promise.resolve();
let renderer: THREE.WebGLRenderer | null = null;

/**
 * Bir model dosyasının küçük resmini (data URL) üretir; üretilemezse null döner.
 * Tek bir paylaşılan WebGL bağlamı kullanır ve modelleri sırayla işler: kart başına
 * canlı bir 3B sahne açmak tarayıcının bağlam sınırını hızla doldururdu.
 */
export function modelThumbnail(url: string, format: ModelFormat): Promise<string | null> {
  let pending = cache.get(url);
  if (!pending) {
    pending = queue.then(() => render(url, format)).catch((err) => {
      console.warn('Küçük resim üretilemedi:', url, err);
      return null;
    });
    queue = pending;
    cache.set(url, pending);
  }
  return pending;
}

async function render(url: string, format: ModelFormat): Promise<string | null> {
  const head = await fetch(url, { method: 'HEAD' });
  const size = Number(head.headers.get('content-length'));
  if (!head.ok || !size || size > MAX_BYTES) return null;

  const { object, size: modelSize } = await loadModel(url, format);

  const scene = new THREE.Scene();
  scene.add(object);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x1b2023, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(2, 3, 2.5);
  scene.add(key);

  // Modeli çerçeveye sığdır: sınır küresine göre kamera mesafesi
  const sphere = new THREE.Box3().setFromObject(object, true).getBoundingSphere(new THREE.Sphere());
  const radius = sphere.radius || modelSize / 2;
  const camera = new THREE.PerspectiveCamera(30, WIDTH / HEIGHT, radius / 100, radius * 100);
  const distance = (radius / Math.sin(THREE.MathUtils.degToRad(15))) * 1.02;
  camera.position.copy(sphere.center).add(new THREE.Vector3(1, 0.6, 1.1).normalize().multiplyScalar(distance));
  camera.lookAt(sphere.center);

  renderer ??= new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(1);
  renderer.setSize(WIDTH, HEIGHT, false);
  renderer.render(scene, camera);
  const image = renderer.domElement.toDataURL('image/png');

  disposeObject(object);
  return image;
}
