import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Loader2 } from 'lucide-react';

interface StlPreviewProps {
  url: string;
  color?: string;
}

export default function StlPreview({ url, color = '#a855f7' }: StlPreviewProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let currentRef = mountRef.current;
    if (!currentRef) return;

    // Sahne, Kamera, Render motoru ayarları
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#1a1b22');

    const width = currentRef.clientWidth;
    const height = currentRef.clientHeight;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    currentRef.appendChild(renderer.domElement);

    // Işıklandırma
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Kontroller (Fare ile çevirme)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Yükleyici
    const loader = new STLLoader();
    
    loader.load(
      url,
      (geometry: THREE.BufferGeometry) => {
        const material = new THREE.MeshStandardMaterial({ 
          color: color, 
          roughness: 0.4, 
          metalness: 0.1 
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Geometriyi merkeze al
        geometry.computeBoundingBox();
        const box = geometry.boundingBox;
        if(box) {
          const center = new THREE.Vector3();
          box.getCenter(center);
          mesh.position.sub(center); // Merkeze taşı
          
          // Boyutu hesapla ve kamerayı ayarla
          const size = new THREE.Vector3();
          box.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z);
          
          const fov = camera.fov * (Math.PI / 180);
          let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
          cameraZ *= 2.5; // Biraz daha uzaklaştır

          camera.position.set(cameraZ, cameraZ, cameraZ);
          camera.lookAt(0,0,0);
          
          // Yardımcı Eksenler (Grid ve Axes)
          const gridHelper = new THREE.GridHelper(maxDim * 3, 20, 0x444444, 0x222222);
          gridHelper.position.y = -size.y / 2;
          scene.add(gridHelper);
          
          const axesHelper = new THREE.AxesHelper(maxDim);
          scene.add(axesHelper);
        }

        // Kapsayıcı obje oluştur (etrafında dönmesi için)
        const wrapper = new THREE.Group();
        wrapper.add(mesh);
        scene.add(wrapper);

        controls.update();
        setLoading(false);
      },
      (xhr: ProgressEvent) => {
        // Yükleme progress
      },
      (err: unknown) => {
        console.error("STL Yükleme Hatası:", err);
        setError("Model yüklenirken bir hata oluştu veya dosya bozuk.");
        setLoading(false);
      }
    );

    // Animasyon Döngüsü
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Yeniden Boyutlandırma
    const handleResize = () => {
      if (!currentRef) return;
      const w = currentRef.clientWidth;
      const h = currentRef.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      currentRef?.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [url, color]);

  return (
    <div className="w-full h-full relative" ref={mountRef}>
      {loading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1b22] z-10 text-[#a855f7]">
          <Loader2 className="w-10 h-10 animate-spin mb-4" />
          <span className="font-black uppercase tracking-widest text-sm">Model Çözümleniyor...</span>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1a1b22] z-10 text-[#ff0055] p-4 text-center">
          <span className="font-black uppercase tracking-widest text-sm">{error}</span>
        </div>
      )}
    </div>
  );
}
