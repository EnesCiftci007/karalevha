import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

interface Gerber3DViewProps {
  topSvg: string;
  bottomSvg: string;
}

/** SVG viewBox'ından kartın en/boy oranını okur */
function parseViewBox(svg: string): { w: number; h: number } {
  const m = svg.match(/viewBox=["']([^"']+)["']/i);
  if (m) {
    const parts = m[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { w: parts[2], h: parts[3] };
    }
  }
  return { w: 100, h: 70 };
}

/** SVG metnini yüksek çözünürlüklü Three.js dokusuna dönüştürür */
function svgToTexture(svg: string, width: number, height: number, maxAniso: number): Promise<THREE.CanvasTexture> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas oluşturulamadı.'));
      ctx.fillStyle = '#0e4d25';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAniso;
      tex.needsUpdate = true;
      resolve(tex);
    };
    img.onerror = () => reject(new Error('PCB dokusu oluşturulamadı.'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/**
 * Gerber üst ve alt yüz SVG'lerini 1.6 mm kalınlığında FR-4 kart üzerine kaplayarak
 * fareyle 360° incelenebilen etkileşimli 3B PCB önizlemesi sunar.
 */
export default function Gerber3DView({ topSvg, bottomSvg }: Gerber3DViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let rafId = 0;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
    // Ön (+Z) yüzeyi hafif açılı gösteren başlangıç kamerası
    camera.position.set(1.6, -2.8, 4.6);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.5;
    controls.maxDistance = 18;

    scene.add(new THREE.HemisphereLight(0xeef6ff, 0x243447, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.3);
    key.position.set(4, -5, 8);
    scene.add(key);
    const back = new THREE.DirectionalLight(0xdbeafe, 0.9);
    back.position.set(-4, 5, -8);
    scene.add(back);

    const { w: rawW, h: rawH } = parseViewBox(topSvg);
    const maxDim = Math.max(rawW, rawH);
    const scale = 4.2 / maxDim;
    const boardW = rawW * scale;
    const boardH = rawH * scale;
    const thickness = Math.max(0.06, Math.min(0.16, boardW * 0.028));

    const texMax = 2048;
    const texW = Math.max(256, Math.round((rawW / maxDim) * texMax));
    const texH = Math.max(256, Math.round((rawH / maxDim) * texMax));
    const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    let geometry: THREE.BoxGeometry | null = null;
    let materials: THREE.MeshStandardMaterial[] = [];
    let textures: THREE.CanvasTexture[] = [];

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    Promise.all([
      svgToTexture(topSvg, texW, texH, maxAniso),
      svgToTexture(bottomSvg, texW, texH, maxAniso),
    ])
      .then(([topTex, bottomTex]) => {
        if (disposed) {
          topTex.dispose();
          bottomTex.dispose();
          return;
        }
        textures = [topTex, bottomTex];

        const edgeMat = new THREE.MeshStandardMaterial({
          color: 0x8f8a62,
          roughness: 0.72,
          metalness: 0.05,
        });
        const topMat = new THREE.MeshStandardMaterial({
          map: topTex,
          roughness: 0.3,
          metalness: 0.22,
        });
        const bottomMat = new THREE.MeshStandardMaterial({
          map: bottomTex,
          roughness: 0.3,
          metalness: 0.22,
        });
        materials = [edgeMat, edgeMat, edgeMat, edgeMat, topMat, bottomMat];

        geometry = new THREE.BoxGeometry(boardW, boardH, thickness);
        const mesh = new THREE.Mesh(geometry, materials);
        scene.add(mesh);

        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();
        setReady(true);

        const tick = () => {
          if (disposed) return;
          rafId = requestAnimationFrame(tick);
          controls.update();
          renderer.render(scene, camera);
        };
        tick();
      })
      .catch((err) => {
        if (!disposed) setError(err instanceof Error ? err.message : '3B görünüm başlatılamadı.');
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      controls.dispose();
      geometry?.dispose();
      new Set(materials).forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [topSvg, bottomSvg]);

  if (error) {
    return <p className="p-6 text-sm text-hata">{error}</p>;
  }

  return (
    <div className="relative w-full h-full" style={{ background: 'linear-gradient(180deg, #b8d0dc 0%, #5b758c 55%, #1d2c3f 100%)' }}>
      <div ref={hostRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-tebesir" />
        </div>
      )}
      {ready && (
        <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-levha/80 border border-levha-cizgi px-3 py-1 text-xs text-tebesir-soluk backdrop-blur">
          Sürükle: 360° döndür · Tekerlek: yakınlaştır · (3B parçalar için .kicad_pcb veya .step yükle)
        </p>
      )}
    </div>
  );
}
