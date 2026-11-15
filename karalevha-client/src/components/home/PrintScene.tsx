import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PRINT_MODELS, modelByName, type PrintModelDef } from './printModels';

// Bir dilimleyici gibi her katmanın kesitini çıkarıp (işaretli uzaklık alanı + marching squares)
// modeli katman katman "basıyoruz". Her baskı bitince sıradaki model rastgele seçilir.
const LAYER_HEIGHT = 0.026;
const GRID = 72;          // kesit ızgarası (GRID x GRID)
const EXTENT = 1.25;      // ızgaranın yarı genişliği (model birimi)

const HOLD_SECONDS = 4;   // bitmiş modeli gösterme süresi
/** Baskı süresi katman sayısıyla orantılı: alçak devre kartı kısa, uzun robot daha uzun sürer */
const printSeconds = (layers: number) => 5 + 11 * (layers / 90);

const CHALK = '#ecebe6';
const MARK = '#d4ff3d';
const LINE = '#2e2e2e';

interface Toolpath {
  positions: Float32Array;
  /** Her katmanın başladığı köşe indeksi */
  layerStart: number[];
  layers: number;
}

/**
 * Baskı yolu: her katmanın kesit çizgileri (doğru parçası çiftleri) ve her katmanın başladığı
 * köşe indeksi. Katmanlar aşağıdan yukarı sıralıdır; ilk katman tabla üzerindedir.
 */
export function buildToolpath(model: PrintModelDef): Toolpath {
  const layers = Math.ceil(model.height / LAYER_HEIGHT);
  const out: number[] = [];
  const layerStart: number[] = [];
  const step = (EXTENT * 2) / GRID;
  const values = new Float32Array((GRID + 1) * (GRID + 1));
  const at = (i: number, j: number) => values[j * (GRID + 1) + i];
  const lerp = (a: number, b: number) => a / (a - b); // sıfır geçişinin kesirli konumu

  for (let layer = 0; layer < layers; layer++) {
    layerStart.push(out.length / 3);
    const y = (layer + 0.5) * LAYER_HEIGHT;
    for (let j = 0; j <= GRID; j++)
      for (let i = 0; i <= GRID; i++)
        values[j * (GRID + 1) + i] = model.sdf(-EXTENT + i * step, y, -EXTENT + j * step);

    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const v0 = at(i, j), v1 = at(i + 1, j), v2 = at(i + 1, j + 1), v3 = at(i, j + 1);
        const pts: [number, number][] = [];
        const x0 = -EXTENT + i * step, z0 = -EXTENT + j * step;
        if ((v0 < 0) !== (v1 < 0)) pts.push([x0 + lerp(v0, v1) * step, z0]);
        if ((v1 < 0) !== (v2 < 0)) pts.push([x0 + step, z0 + lerp(v1, v2) * step]);
        if ((v3 < 0) !== (v2 < 0)) pts.push([x0 + lerp(v3, v2) * step, z0 + step]);
        if ((v0 < 0) !== (v3 < 0)) pts.push([x0, z0 + lerp(v0, v3) * step]);
        for (let k = 0; k + 1 < pts.length; k += 2) {
          out.push(pts[k][0], y, pts[k][1], pts[k + 1][0], y, pts[k + 1][1]);
        }
      }
    }
  }
  return { positions: new Float32Array(out), layerStart, layers };
}

// Her modelin yolu ilk seçildiğinde hesaplanır ve saklanır (sayfa açılışını yavaşlatmasın)
const toolpaths = new Map<PrintModelDef, Toolpath>();
const toolpathOf = (model: PrintModelDef) => {
  let path = toolpaths.get(model);
  if (!path) toolpaths.set(model, (path = buildToolpath(model)));
  return path;
};

/** Sıradaki model: rastgele, ama bir öncekinin aynısı değil. İlk model adresle seçilebilir: /?baski=robot */
function nextModel(previous: PrintModelDef | null): PrintModelDef {
  if (!previous) {
    const wanted = new URLSearchParams(window.location.search).get('baski');
    const match = PRINT_MODELS.find((m) => m.name === wanted);
    if (match) return match;
  }
  const choices = PRINT_MODELS.filter((m) => m !== previous);
  return choices[Math.floor(Math.random() * choices.length)];
}

const pad = (n: number) => String(n).padStart(3, '0');

/**
 * Ana sayfadaki 3B sahne: kara tahta üzerinde tebeşir çizgisiyle katman katman basılan modeller.
 * Sayfa görünmüyorken durur; "hareketi azalt" tercihi açıkken bitmiş bir modeli sabit gösterir.
 */
interface PrintSceneProps {
  className?: string;
  /** Geniş ekranda (≥1024px) görüntüyü genişliğin bu payı kadar sağa kaydır: solda yazıya yer kalsın */
  shiftRight?: number;
  /** Verilirse yalnızca bu model basılır (baskı bitince yeniden başlar); verilmezse modeller rastgele sırayla */
  model?: string;
}

export default function PrintScene({ className = 'h-[280px] sm:h-[320px]', shiftRight = 0, model: fixedName }: PrintSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const layerLabelRef = useRef<HTMLSpanElement>(null);
  const totalLabelRef = useRef<HTMLSpanElement>(null);
  const nameLabelRef = useRef<HTMLSpanElement>(null);
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
    const target = new THREE.Vector3(0, 0.95, 0);
    // Ön yüz izleyiciye dönük, hafif yukarıdan. Dar (dikey) sahnede kamera geri çekilir, model yanlardan taşmaz.
    const cameraHome = new THREE.Vector3(1.6, 2.9, 7.4);
    camera.position.copy(cameraHome);
    camera.lookAt(target);

    const group = new THREE.Group();
    scene.add(group);

    // Baskı tablası
    const bed = new THREE.GridHelper(3.6, 12, LINE, LINE);
    group.add(bed);

    // Basılan yol ve o an basılan katman (aynı köşe verisi, ayrı çizim aralığı)
    const printedMaterial = new THREE.LineBasicMaterial({ color: CHALK, transparent: true, opacity: 0.6 });
    const freshMaterial = new THREE.LineBasicMaterial({ color: MARK });
    let printedGeometry = new THREE.BufferGeometry();
    let freshGeometry = new THREE.BufferGeometry();
    const printed = new THREE.LineSegments(printedGeometry, printedMaterial);
    const fresh = new THREE.LineSegments(freshGeometry, freshMaterial);
    group.add(printed, fresh);

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
      // Kamera yerinde kalır, yalnızca görüntü kayar (perspektif bozulmaz)
      if (shiftRight > 0 && w >= 1024) camera.setViewOffset(w, h, -w * shiftRight, 0, w, h);
      else camera.clearViewOffset();
      camera.updateProjectionMatrix();
      const pullBack = Math.max(1, 1.15 / camera.aspect);
      camera.position.copy(cameraHome).multiplyScalar(pullBack);
      camera.lookAt(target);
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);

    // Şu anki baskı. Sabit model verildiyse hep o basılır.
    const fixed = fixedName ? modelByName(fixedName) : undefined;
    const pick = (previous: PrintModelDef | null) => fixed ?? nextModel(previous);
    let model: PrintModelDef = pick(null);
    let path = toolpathOf(model);
    let duration = printSeconds(path.layers);

    /** Yeni modeli tablaya koy: geometrileri yenile, kamerayı modelin ortasına çevir */
    const load = (next: PrintModelDef) => {
      model = next;
      path = toolpathOf(model);
      duration = printSeconds(path.layers);
      printedGeometry.dispose();
      freshGeometry.dispose();
      const attribute = new THREE.BufferAttribute(path.positions, 3);
      printedGeometry = new THREE.BufferGeometry();
      printedGeometry.setAttribute('position', attribute);
      freshGeometry = new THREE.BufferGeometry();
      freshGeometry.setAttribute('position', attribute);
      printed.geometry = printedGeometry;
      fresh.geometry = freshGeometry;
      target.set(0, Math.max(0.35, model.height * 0.42), 0);
      if (controls) controls.target.copy(target);
      else camera.lookAt(target);
      if (nameLabelRef.current) nameLabelRef.current.textContent = model.name;
      if (totalLabelRef.current) totalLabelRef.current.textContent = pad(path.layers);
      mount.setAttribute('aria-label', `Bir ${model.name} modelinin katman katman basıldığı 3B animasyon`);
    };
    load(model);

    /** Yolun ilk `count` noktasını basılmış göster. */
    const showProgress = (count: number) => {
      const total = path.positions.length / 3;
      count -= count % 2; // parçalar köşe çifti hâlinde
      printedGeometry.setDrawRange(0, count);

      // Şu anki katmanın başı: count'tan küçük en büyük katman başlangıcı
      const { layerStart } = path;
      let layerIndex = 0;
      while (layerIndex + 1 < layerStart.length && layerStart[layerIndex + 1] <= count) layerIndex++;
      const freshStart = layerStart[layerIndex];
      freshGeometry.setDrawRange(freshStart, count - freshStart);

      const done = count >= total;
      nozzle.visible = !done && count > 0;
      fresh.visible = !done;
      if (nozzle.visible) {
        const i = (count - 1) * 3;
        nozzle.position.set(path.positions[i], path.positions[i + 1], path.positions[i + 2]);
      }

      const text = pad(done ? path.layers : Math.min(path.layers, layerIndex + 1));
      const label = layerLabelRef.current;
      if (label && label.textContent !== text) label.textContent = text;
    };

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Sıradaki model, bitmiş model ekranda beklerken boş anda dilimlenir; geçişte takılma olmaz
    let upcoming: PrintModelDef | null = null;
    const idle = window.requestIdleCallback ?? ((fn: () => void) => window.setTimeout(fn, 50));
    let frame = 0;
    let running = false;
    let elapsed = 0;
    let swing = 0;
    let last = 0;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      // Süre duvar saatine göre ilerler; kare atlansa da baskı aynı hızda sürer. Sekme gizlenince ya da
      // sahne ekrandan çıkınca döngü durur ve `last` yeniden başlar, bu yüzden büyük sıçrama olmaz.
      const dt = Math.max(0, (now - last) / 1000);
      last = now;

      if (!reducedMotion) {
        elapsed += dt;
        if (elapsed >= duration && !upcoming) {
          const chosen = (upcoming = pick(model));
          idle(() => toolpathOf(chosen));
        }
        if (elapsed >= duration + HOLD_SECONDS) {
          elapsed = 0;
          load(upcoming ?? pick(model));
          upcoming = null;
        }
        const total = path.positions.length / 3;
        showProgress(Math.min(total, Math.floor((elapsed / duration) * total)));
        // Tam tur yerine sağa sola salınım: ön yüz hep görünür kalsın
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

    if (reducedMotion) showProgress(path.positions.length / 3);

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
      [printedMaterial, freshMaterial, nozzle.material, bed.material].flat().forEach((m) => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [shiftRight, fixedName]);

  if (failed) return null;

  return (
    <figure className="relative">
      <div
        ref={mountRef}
        className={`${className} w-full [&>canvas]:block lg:cursor-grab lg:active:cursor-grabbing`}
        role="img"
        aria-label="Bir modelin katman katman basıldığı 3B animasyon"
      />
      <figcaption className="veri flex items-center justify-between gap-3 px-1">
        <span>
          <span ref={nameLabelRef} className="text-tebesir" /> · katman <span ref={layerLabelRef} className="text-tebesir">000</span> / <span ref={totalLabelRef}>000</span>
        </span>
        <span className="hidden lg:inline">sürükleyerek çevir</span>
      </figcaption>
    </figure>
  );
}
