import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Model: "vazo modu"nda basılan, burgulu ve loblu bir vazo. Tek kesintisiz sarmal yol.
const LAYERS = 90;
const POINTS_PER_LAYER = 96;
const TOTAL = LAYERS * POINTS_PER_LAYER;
const LAYER_HEIGHT = 0.028;

const PRINT_SECONDS = 16; // baştan sona baskı süresi
const HOLD_SECONDS = 5;   // bitmiş modeli gösterme süresi

const CHALK = '#ece7dc';
const MARK = '#f2c230';
const LINE = '#2a3135';

/** Baskı yolunun tamamı: [x, y, z, x, y, z, ...] (y yukarı). */
function buildToolpath(): Float32Array {
  const path = new Float32Array(TOTAL * 3);
  for (let i = 0; i < TOTAL; i++) {
    const layer = i / POINTS_PER_LAYER;            // kesirli katman numarası
    const angle = (i % POINTS_PER_LAYER) / POINTS_PER_LAYER * Math.PI * 2;
    const h = layer / LAYERS;                      // 0..1 yükseklik oranı

    // Vazo silüeti: aşağıda dar, ortada geniş, ağızda hafif açılan
    const silhouette = 0.62 + 0.3 * Math.sin(h * Math.PI * 1.15 + 0.35) + 0.12 * h * h;
    // Yükseldikçe dönen beş lob
    const lobes = 1 + 0.11 * Math.cos(5 * angle + h * Math.PI * 1.6);
    const r = silhouette * lobes;

    path[i * 3] = Math.cos(angle) * r;
    path[i * 3 + 1] = layer * LAYER_HEIGHT;
    path[i * 3 + 2] = Math.sin(angle) * r;
  }
  return path;
}

/**
 * Ana sayfadaki 3B sahne: kara tahta üzerinde tebeşir çizgisiyle katman katman basılan bir model.
 * Sayfa görünmüyorken durur; "hareketi azalt" tercihi açıkken bitmiş modeli sabit gösterir.
 */
export default function PrintScene() {
  const mountRef = useRef<HTMLDivElement>(null);
  const layerLabelRef = useRef<HTMLSpanElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFailed(true); // WebGL yoksa sahneyi hiç gösterme
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    const modelHeight = LAYERS * LAYER_HEIGHT;
    const target = new THREE.Vector3(0, modelHeight * 0.42, 0);
    camera.position.set(5.3, 3.4, 5.3);
    camera.lookAt(target);

    const group = new THREE.Group();
    scene.add(group);

    // Baskı tablası
    const bed = new THREE.GridHelper(3.6, 12, LINE, LINE);
    group.add(bed);

    // Basılan yol: çizim aralığı (drawRange) ilerledikçe model "basılır"
    const path = buildToolpath();
    const printedGeometry = new THREE.BufferGeometry();
    printedGeometry.setAttribute('position', new THREE.BufferAttribute(path, 3));
    printedGeometry.setDrawRange(0, 0);
    const printed = new THREE.Line(
      printedGeometry,
      new THREE.LineBasicMaterial({ color: CHALK, transparent: true, opacity: 0.6 }),
    );
    group.add(printed);

    // O an basılan katman: sarı, taze çizgi
    const freshPositions = new Float32Array(POINTS_PER_LAYER * 3);
    const freshGeometry = new THREE.BufferGeometry();
    freshGeometry.setAttribute('position', new THREE.BufferAttribute(freshPositions, 3));
    freshGeometry.setDrawRange(0, 0);
    const fresh = new THREE.Line(freshGeometry, new THREE.LineBasicMaterial({ color: MARK }));
    group.add(fresh);

    // Baskı kafası
    const nozzleGeometry = new THREE.ConeGeometry(0.07, 0.22, 16);
    nozzleGeometry.rotateX(Math.PI);        // ucu aşağı baksın
    nozzleGeometry.translate(0, 0.11, 0);   // uç noktası orijinde olsun
    const nozzle = new THREE.Mesh(nozzleGeometry, new THREE.MeshBasicMaterial({ color: MARK }));
    group.add(nozzle);

    // Fareyle çevirme. Dokunmatik ekranda kapalı: sayfa kaydırmasını engellemesin.
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    let controls: OrbitControls | null = null;
    if (!coarsePointer) {
      controls = new OrbitControls(camera, renderer.domElement);
      controls.target.copy(target);
      controls.enableZoom = false; // tekerlek sayfayı kaydırmaya devam etsin
      controls.enablePan = false;
      controls.enableDamping = true;
      controls.minPolarAngle = 0.5;
      controls.maxPolarAngle = 1.5;
    }

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = mount;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /** Yolun ilk `count` noktasını basılmış göster. */
    const showProgress = (count: number) => {
      printedGeometry.setDrawRange(0, count);

      const freshCount = Math.min(count, POINTS_PER_LAYER);
      freshPositions.set(path.subarray((count - freshCount) * 3, count * 3));
      freshGeometry.attributes.position.needsUpdate = true;
      freshGeometry.setDrawRange(0, freshCount);

      const done = count >= TOTAL;
      nozzle.visible = !done && count > 0;
      fresh.visible = !done;
      if (nozzle.visible) {
        const i = (count - 1) * 3;
        nozzle.position.set(path[i], path[i + 1], path[i + 2]);
      }

      const layer = Math.min(LAYERS, Math.floor(count / POINTS_PER_LAYER) + (done ? 0 : 1));
      const label = layerLabelRef.current;
      const text = String(layer).padStart(3, '0');
      if (label && label.textContent !== text) label.textContent = text;
    };

    let frame = 0;
    let running = false;
    let elapsed = 0;
    let last = 0;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      // Süre duvar saatine göre ilerler; kare atlansa da baskı aynı hızda sürer (döngü olduğu için sıçrama zararsız)
      const dt = Math.max(0, (now - last) / 1000); // ilk karede zaman damgası geride kalabilir
      last = now;

      if (!reducedMotion) {
        elapsed = (elapsed + dt) % (PRINT_SECONDS + HOLD_SECONDS);
        showProgress(Math.min(TOTAL, Math.floor((elapsed / PRINT_SECONDS) * TOTAL)));
        group.rotation.y += dt * 0.12;
      }
      controls?.update();
      renderer.render(scene, camera);
    };

    const start = () => {
      if (running) return;
      running = true;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(frame);
    };

    if (reducedMotion) showProgress(TOTAL);

    // Yalnızca ekrandayken ve sekme açıkken çalış
    let onScreen = false;
    const sync = () => (onScreen && !document.hidden ? start() : stop());
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    });
    intersectionObserver.observe(mount);
    document.addEventListener('visibilitychange', sync);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', sync);
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
      controls?.dispose();
      printedGeometry.dispose();
      freshGeometry.dispose();
      nozzleGeometry.dispose();
      bed.geometry.dispose();
      [printed.material, fresh.material, nozzle.material, bed.material].flat().forEach((m) => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  if (failed) return null;

  return (
    <figure className="relative">
      <div
        ref={mountRef}
        className="h-[280px] sm:h-[340px] lg:h-[400px] w-full [&>canvas]:block lg:cursor-grab lg:active:cursor-grabbing"
        role="img"
        aria-label="Katman katman basılan bir 3B model animasyonu"
      />
      <figcaption className="veri flex items-center justify-between px-1">
        <span>
          katman <span ref={layerLabelRef} className="text-tebesir">000</span> / {String(LAYERS).padStart(3, '0')}
        </span>
        <span className="hidden lg:inline">sürükleyerek çevir</span>
      </figcaption>
    </figure>
  );
}
