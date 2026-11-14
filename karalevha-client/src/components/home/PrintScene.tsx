import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Model: kulüp maskotunun kafatası. Bir dilimleyici gibi her katmanın kesitini çıkarıp
// (işaretli uzaklık alanı + marching squares) katman katman "basıyoruz". Göz ve burun boşlukları
// kesitte delik olarak, dişler çene önünde çentik olarak görünür.
const LAYERS = 90;
const LAYER_HEIGHT = 0.026;
const GRID = 72;          // kesit ızgarası (GRID x GRID)
const EXTENT = 1.25;      // ızgaranın yarı genişliği (model birimi)

const PRINT_SECONDS = 16; // baştan sona baskı süresi
const HOLD_SECONDS = 5;   // bitmiş modeli gösterme süresi

const CHALK = '#ecebe6';
const MARK = '#d4ff3d';
const LINE = '#2e2e2e';

const sphere = (x: number, y: number, z: number, cx: number, cy: number, cz: number, r: number) =>
  Math.hypot(x - cx, y - cy, z - cz) - r;

function roundBox(x: number, y: number, z: number, cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, r: number) {
  const qx = Math.abs(x - cx) - hx + r;
  const qy = Math.abs(y - cy) - hy + r;
  const qz = Math.abs(z - cz) - hz + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
}

/** Yumuşak birleşim / çıkarma (k: geçiş genişliği) */
const smoothUnion = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - (h * h * k) / 4;
};
const smoothSubtract = (a: number, b: number, k: number) => -smoothUnion(-a, b, k);

/** Kafatasının işaretli uzaklık alanı: içi negatif. y yukarı, z yüz yönü. */
function skull(x: number, y: number, z: number): number {
  // Kubbe (önden arkaya biraz uzun) + yüz/çene bloğu
  let d = sphere(x, y, z * 0.92, 0, 1.42, -0.08, 0.86);
  // Elmacık kemikleri: kafatasına "ampul" değil kafatası silüeti verir
  d = smoothUnion(d, sphere(x, y, z, -0.5, 0.98, 0.32, 0.34), 0.3);
  d = smoothUnion(d, sphere(x, y, z, 0.5, 0.98, 0.32, 0.34), 0.3);
  // Üst çene ve dişler
  d = smoothUnion(d, roundBox(x, y, z, 0, 0.52, 0.22, 0.48, 0.42, 0.48, 0.2), 0.3);
  // Göz çukurları ve burun
  d = smoothSubtract(d, sphere(x, y, z, -0.33, 1.1, 0.78, 0.3), 0.06);
  d = smoothSubtract(d, sphere(x, y, z, 0.33, 1.1, 0.78, 0.3), 0.06);
  d = smoothSubtract(d, roundBox(x, y, z, 0, 0.76, 0.78, 0.08, 0.13, 0.3, 0.06), 0.04);
  // Diş araları: çenenin önünde dikey çentikler
  for (const tx of [-0.27, -0.09, 0.09, 0.27]) {
    d = Math.max(d, -roundBox(x, y, z, tx, 0.2, 0.72, 0.025, 0.2, 0.2, 0.01));
  }
  return d;
}

/**
 * Baskı yolu: her katmanın kesit çizgileri (doğru parçası çiftleri) ve her katmanın başladığı
 * köşe indeksi. Katmanlar aşağıdan yukarı sıralıdır; ilk katman tabla üzerindedir.
 */
function buildToolpath(): { positions: Float32Array; layerStart: number[] } {
  const out: number[] = [];
  const layerStart: number[] = [];
  const step = (EXTENT * 2) / GRID;
  const values = new Float32Array((GRID + 1) * (GRID + 1));
  const at = (i: number, j: number) => values[j * (GRID + 1) + i];
  const lerp = (a: number, b: number) => a / (a - b); // sıfır geçişinin kesirli konumu

  for (let layer = 0; layer < LAYERS; layer++) {
    layerStart.push(out.length / 3);
    const y = 0.08 + layer * LAYER_HEIGHT;
    for (let j = 0; j <= GRID; j++)
      for (let i = 0; i <= GRID; i++)
        values[j * (GRID + 1) + i] = skull(-EXTENT + i * step, y, -EXTENT + j * step);

    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const v0 = at(i, j), v1 = at(i + 1, j), v2 = at(i + 1, j + 1), v3 = at(i, j + 1);
        // Hücre kenarlarındaki sıfır geçişleri (marching squares)
        const pts: [number, number][] = [];
        const x0 = -EXTENT + i * step, z0 = -EXTENT + j * step;
        if ((v0 < 0) !== (v1 < 0)) pts.push([x0 + lerp(v0, v1) * step, z0]);
        if ((v1 < 0) !== (v2 < 0)) pts.push([x0 + step, z0 + lerp(v1, v2) * step]);
        if ((v3 < 0) !== (v2 < 0)) pts.push([x0 + lerp(v3, v2) * step, z0 + step]);
        if ((v0 < 0) !== (v3 < 0)) pts.push([x0, z0 + lerp(v0, v3) * step]);
        for (let k = 0; k + 1 < pts.length; k += 2) {
          out.push(pts[k][0], y - 0.08, pts[k][1], pts[k + 1][0], y - 0.08, pts[k + 1][1]);
        }
      }
    }
  }
  return { positions: new Float32Array(out), layerStart };
}

const TOOLPATH = buildToolpath();
const TOTAL = TOOLPATH.positions.length / 3; // köşe sayısı (her parça 2 köşe)

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
    // Kafatasının yüzü (+z) izleyiciye dönük, hafif yukarıdan
    camera.position.set(1.6, 2.9, 7.4);
    camera.lookAt(target);

    const group = new THREE.Group();
    scene.add(group);

    // Baskı tablası
    const bed = new THREE.GridHelper(3.6, 12, LINE, LINE);
    group.add(bed);

    // Basılan yol: çizim aralığı (drawRange) ilerledikçe model "basılır"
    const { positions: path, layerStart } = TOOLPATH;
    const pathAttribute = new THREE.BufferAttribute(path, 3);
    const printedGeometry = new THREE.BufferGeometry();
    printedGeometry.setAttribute('position', pathAttribute);
    printedGeometry.setDrawRange(0, 0);
    const printed = new THREE.LineSegments(
      printedGeometry,
      new THREE.LineBasicMaterial({ color: CHALK, transparent: true, opacity: 0.6 }),
    );
    group.add(printed);

    // O an basılan katman: aynı köşe verisi, ayrı çizim aralığı, altın renk
    const freshGeometry = new THREE.BufferGeometry();
    freshGeometry.setAttribute('position', pathAttribute);
    freshGeometry.setDrawRange(0, 0);
    const fresh = new THREE.LineSegments(freshGeometry, new THREE.LineBasicMaterial({ color: MARK }));
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
      count -= count % 2; // parçalar köşe çifti hâlinde
      printedGeometry.setDrawRange(0, count);

      // Şu anki katmanın başı: count'tan küçük en büyük katman başlangıcı
      let layerIndex = 0;
      while (layerIndex + 1 < layerStart.length && layerStart[layerIndex + 1] <= count) layerIndex++;
      const freshStart = layerStart[layerIndex];
      freshGeometry.setDrawRange(freshStart, count - freshStart);

      const done = count >= TOTAL;
      nozzle.visible = !done && count > 0;
      fresh.visible = !done;
      if (nozzle.visible) {
        const i = (count - 1) * 3;
        nozzle.position.set(path[i], path[i + 1], path[i + 2]);
      }

      const layer = done ? LAYERS : Math.min(LAYERS, layerIndex + 1);
      const label = layerLabelRef.current;
      const text = String(layer).padStart(3, '0');
      if (label && label.textContent !== text) label.textContent = text;
    };

    let frame = 0;
    let running = false;
    let elapsed = 0;
    let swing = 0;
    let last = 0;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      // Süre duvar saatine göre ilerler; kare atlansa da baskı aynı hızda sürer (döngü olduğu için sıçrama zararsız)
      const dt = Math.max(0, (now - last) / 1000); // ilk karede zaman damgası geride kalabilir
      last = now;

      if (!reducedMotion) {
        elapsed = (elapsed + dt) % (PRINT_SECONDS + HOLD_SECONDS);
        showProgress(Math.min(TOTAL, Math.floor((elapsed / PRINT_SECONDS) * TOTAL)));
        // Tam tur yerine sağa sola salınım: yüz hep görünür kalsın
        swing += dt;
        group.rotation.y = Math.sin(swing * 0.35) * 0.55;
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
        aria-label="Bir kafatasının katman katman basıldığı 3B animasyon"
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
