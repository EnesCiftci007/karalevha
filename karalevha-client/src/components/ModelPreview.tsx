import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Loader2 } from 'lucide-react';
import { disposeObject, loadModel, type ModelFormat } from '../utils/loadModel';

interface ModelPreviewProps {
  url: string;
  format: ModelFormat;
  /** Kendi malzemesi olmayan modellerin (STL, OBJ) rengi */
  color?: string;
}

/**
 * Fareyle çevrilebilen 3B önizleme. FBX ve GLB içindeki ilk animasyonu oynatır.
 */
export default function ModelPreview({ url, format, color = '#f2c230' }: ModelPreviewProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [animationName, setAnimationName] = useState<string | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    setStatus('loading');
    setAnimationName(null);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
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
    let model: THREE.Object3D | null = null;
    let grid: THREE.GridHelper | null = null;
    let mixer: THREE.AnimationMixer | null = null;

    loadModel(url, format, color)
      .then(({ object, size, animations }) => {
        if (cancelled) {
          disposeObject(object);
          return;
        }
        model = object;
        scene.add(object);

        // Tabla ve kamera modelin boyutuna göre
        grid = new THREE.GridHelper(size * 3, 20, 0x3a4246, 0x2a3135);
        scene.add(grid);
        const height = new THREE.Box3().setFromObject(object, true).getSize(new THREE.Vector3()).y;
        const target = new THREE.Vector3(0, height / 2, 0);
        const distance = size * 1.8;
        camera.position.set(distance * 0.8, height / 2 + distance * 0.5, distance);
        camera.near = size / 100;
        camera.far = size * 100;
        camera.updateProjectionMatrix();
        controls.target.copy(target);
        controls.minDistance = size * 0.3;
        controls.maxDistance = size * 6;
        controls.update();

        if (animations.length > 0) {
          mixer = new THREE.AnimationMixer(object);
          mixer.clipAction(animations[0]).play();
          setAnimationName(animations[0].name || 'Animasyon');
        }
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
      mixer?.update(clock.getDelta());
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      mixer?.stopAllAction();
      if (model) disposeObject(model);
      grid?.geometry.dispose();
      (grid?.material as THREE.Material | undefined)?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [url, format, color]);

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
      {animationName && (
        <p className="absolute left-3 bottom-3 veri bg-levha/80 px-2 py-1 rounded">▶ {animationName}</p>
      )}
    </div>
  );
}
