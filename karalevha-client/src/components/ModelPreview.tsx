import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Loader2 } from 'lucide-react';
import { disposeObject, loadModel, type ViewFormat } from '../utils/loadModel';

/** Yüklenen modelin özeti (panelde gösterilir) */
export interface ModelStats {
  dimensions: { x: number; y: number; z: number };
  triangles: number;
  meshes: number;
  animations: string[];
}

interface ModelPreviewProps {
  url: string;
  format: ViewFormat;
  /** Kendi malzemesi olmayan modellerin (STL, OBJ) rengi */
  color?: string;
  autoRotate?: boolean;
  wireframe?: boolean;
  grid?: boolean;
  /** Oynatılacak animasyonun sırası; null ise durur */
  animation?: number | null;
  /** Her artışında kamera ilk konumuna döner */
  resetSignal?: number;
  onStats?: (stats: ModelStats) => void;
  /** Sol alttaki animasyon etiketini göster */
  showAnimationLabel?: boolean;
}

/**
 * Fareyle çevrilebilen 3B önizleme. FBX ve GLB içindeki animasyonları oynatır.
 */
export default function ModelPreview({
  url,
  format,
  color = '#f2c230',
  autoRotate = false,
  wireframe = false,
  grid = true,
  animation = 0,
  resetSignal = 0,
  onStats,
  showAnimationLabel = true,
}: ModelPreviewProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [clips, setClips] = useState<THREE.AnimationClip[]>([]);

  // Sahne nesneleri: ayar değişince yeniden yüklemeden güncellemek için
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const homeRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const onStatsRef = useRef(onStats);
  onStatsRef.current = onStats;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    setStatus('loading');
    setClips([]);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
    cameraRef.current = camera;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x1b2023, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(3, 5, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.6);
    rim.position.set(-4, 2, -3);
    scene.add(rim);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotateSpeed = 1.5;
    controlsRef.current = controls;

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = mount;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    let cancelled = false;

    loadModel(url, format, color)
      .then(({ object, size, dimensions, animations }) => {
        if (cancelled) {
          disposeObject(object);
          return;
        }
        modelRef.current = object;
        scene.add(object);

        // Tabla ve kamera modelin boyutuna göre
        const gridHelper = new THREE.GridHelper(size * 3, 20, 0x3a4246, 0x2a3135);
        gridRef.current = gridHelper;
        scene.add(gridHelper);
        const target = new THREE.Vector3(0, dimensions.y / 2, 0);
        // Dar (dikey) ekranda modelin yanları taşmasın diye kamera biraz geri
        const distance = size * 1.8 * Math.max(1, 1 / (camera.aspect || 1));
        camera.position.set(distance * 0.8, dimensions.y / 2 + distance * 0.5, distance);
        camera.near = size / 100;
        camera.far = size * 100;
        camera.updateProjectionMatrix();
        controls.target.copy(target);
        controls.minDistance = size * 0.3;
        controls.maxDistance = size * 6;
        controls.update();
        homeRef.current = { position: camera.position.clone(), target: target.clone() };

        let triangles = 0;
        let meshes = 0;
        object.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh) return;
          meshes++;
          const g = mesh.geometry;
          triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
        });

        if (animations.length > 0) mixerRef.current = new THREE.AnimationMixer(object);
        setClips(animations);
        onStatsRef.current?.({
          dimensions: { x: dimensions.x, y: dimensions.y, z: dimensions.z },
          triangles: Math.round(triangles),
          meshes,
          animations: animations.map((a, i) => a.name || `Animasyon ${i + 1}`),
        });
        setStatus('ready');
      })
      .catch((err) => {
        console.error('Model yüklenemedi:', err);
        if (!cancelled) setStatus('error');
      });

    const clock = new THREE.Clock();
    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      mixerRef.current?.update(clock.getDelta());
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      mixerRef.current?.stopAllAction();
      mixerRef.current = null;
      if (modelRef.current) disposeObject(modelRef.current);
      modelRef.current = null;
      gridRef.current?.geometry.dispose();
      (gridRef.current?.material as THREE.Material | undefined)?.dispose();
      gridRef.current = null;
      controlsRef.current = null;
      homeRef.current = null;
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [url, format, color]);

  // Otomatik döndürme
  useEffect(() => {
    if (controlsRef.current) controlsRef.current.autoRotate = autoRotate;
  }, [autoRotate, status]);

  // Izgara
  useEffect(() => {
    if (gridRef.current) gridRef.current.visible = grid;
  }, [grid, status]);

  // Tel kafes
  useEffect(() => {
    modelRef.current?.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of materials) {
        if ('wireframe' in m) (m as THREE.MeshStandardMaterial).wireframe = wireframe;
      }
    });
  }, [wireframe, status]);

  // Animasyon seçimi
  useEffect(() => {
    const mixer = mixerRef.current;
    if (!mixer) return;
    mixer.stopAllAction();
    if (animation != null && clips[animation]) mixer.clipAction(clips[animation]).reset().play();
  }, [animation, clips]);

  // Görünümü sıfırla
  useEffect(() => {
    const home = homeRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!resetSignal || !home || !camera || !controls) return;
    camera.position.copy(home.position);
    controls.target.copy(home.target);
    controls.update();
  }, [resetSignal]);

  const playing = animation != null ? clips[animation] : undefined;

  return (
    <div className="w-full h-full relative bg-levha-koyu">
      <div ref={mountRef} className="w-full h-full [&>canvas]:block cursor-grab active:cursor-grabbing" />
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-tebesir-silik pointer-events-none">
          <Loader2 className="w-6 h-6 animate-spin mb-3" aria-hidden="true" />
          <span className="text-sm">Model hazırlanıyor…</span>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <p className="text-sm text-hata">Model açılamadı. Dosya bozuk olabilir ya da desteklenmeyen bir özellik kullanıyor.</p>
        </div>
      )}
      {showAnimationLabel && playing && (
        <p className="absolute left-3 bottom-3 veri bg-levha/80 px-2 py-1 rounded">▶ {playing.name || 'Animasyon'}</p>
      )}
    </div>
  );
}
