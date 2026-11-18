/*
 * Ana sayfadaki baskı sahnesinin modelleri. Her model bir işaretli uzaklık alanı (SDF): içi negatif,
 * dışı pozitif; y yukarı, +z izleyiciye bakan yüz. Taban y = 0'da, model |x|, |z| < 1.2 içinde kalır.
 * Dilimleyici her katmanda alanın sıfır çizgisini çıkarır (PrintScene.buildToolpath).
 */

export interface PrintModelDef {
  /** Alt satırda görünen ad */
  name: string;
  /** Model yüksekliği (katman sayısı buradan çıkar) */
  height: number;
  sdf: (x: number, y: number, z: number) => number;
}

/* ---------------------------------------------------------------- Yardımcılar */

const sphere = (x: number, y: number, z: number, cx: number, cy: number, cz: number, r: number) =>
  Math.hypot(x - cx, y - cy, z - cz) - r;

/** Köşeleri r ile yuvarlatılmış kutu; h* yarı genişlikler */
function box(x: number, y: number, z: number, cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, r = 0) {
  const qx = Math.abs(x - cx) - hx + r;
  const qy = Math.abs(y - cy) - hy + r;
  const qz = Math.abs(z - cz) - hz + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
}

/** Dik silindir: merkez (cx, cy, cz), yarıçap r, yarı yükseklik h */
const cylinder = (x: number, y: number, z: number, cx: number, cy: number, cz: number, r: number, h: number) =>
  Math.max(Math.hypot(x - cx, z - cz) - r, Math.abs(y - cy) - h);

const smoothUnion = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - (h * h * k) / 4;
};
const smoothSubtract = (a: number, b: number, k: number) => -smoothUnion(-a, b, k);
const union = (...d: number[]) => Math.min(...d);
const subtract = (a: number, b: number) => Math.max(a, -b);

/* ---------------------------------------------------------------- Modeller */

/** Kulüp maskotunun kafatası: göz ve burun boşlukları kesitte delik, dişler çentik olarak görünür */
function skull(x: number, y: number, z: number): number {
  y += 0.08; // eski modelin tabanı 0.08'deydi
  let d = sphere(x, y, z * 0.92, 0, 1.42, -0.08, 0.86);
  d = smoothUnion(d, sphere(x, y, z, -0.5, 0.98, 0.32, 0.34), 0.3);
  d = smoothUnion(d, sphere(x, y, z, 0.5, 0.98, 0.32, 0.34), 0.3);
  d = smoothUnion(d, box(x, y, z, 0, 0.52, 0.22, 0.48, 0.42, 0.48, 0.2), 0.3);
  d = smoothSubtract(d, sphere(x, y, z, -0.33, 1.1, 0.78, 0.3), 0.06);
  d = smoothSubtract(d, sphere(x, y, z, 0.33, 1.1, 0.78, 0.3), 0.06);
  d = smoothSubtract(d, box(x, y, z, 0, 0.76, 0.78, 0.08, 0.13, 0.3, 0.06), 0.04);
  for (const tx of [-0.27, -0.09, 0.09, 0.27]) d = Math.max(d, -box(x, y, z, tx, 0.2, 0.72, 0.025, 0.2, 0.2, 0.01));
  return d;
}

/** Küçük bir 3B yazıcı: gövde, iki dikme, üst kiriş, tabla, yatay taşıyıcı ve baskı kafası */
function printer(x: number, y: number, z: number): number {
  const base = box(x, y, z, 0, 0.14, 0, 0.98, 0.14, 0.72, 0.05);
  const posts = union(
    box(x, y, z, -0.86, 1.1, 0, 0.08, 1.0, 0.09, 0.02),
    box(x, y, z, 0.86, 1.1, 0, 0.08, 1.0, 0.09, 0.02),
  );
  const top = box(x, y, z, 0, 2.06, 0, 0.94, 0.07, 0.1, 0.02);
  const bed = union(box(x, y, z, 0, 0.56, 0.05, 0.62, 0.035, 0.56, 0.02), box(x, y, z, 0, 0.42, 0.05, 0.1, 0.12, 0.1));
  const gantry = box(x, y, z, 0, 1.42, 0, 0.82, 0.045, 0.06, 0.02);
  const head = union(
    box(x, y, z, 0.18, 1.3, 0.12, 0.15, 0.17, 0.13, 0.03),
    cylinder(x, y, z, 0.18, 1.07, 0.12, 0.035, 0.07),
  );
  // Gövdenin önünde ekran yuvası
  const screen = box(x, y, z, -0.55, 0.15, 0.72, 0.22, 0.07, 0.05);
  return subtract(union(base, posts, top, bed, gantry, head), screen);
}

/** Devre kartı: delikli kart, işlemci, ikinci yonga, kondansatörler, pin dizisi ve USB girişi */
function circuitBoard(x: number, y: number, z: number): number {
  let board = box(x, y, z, 0, 0.06, 0, 1.05, 0.06, 0.75, 0.04);
  for (const [cx, cz] of [[-0.9, -0.6], [0.9, -0.6], [-0.9, 0.6], [0.9, 0.6]]) board = subtract(board, cylinder(x, y, z, cx, 0.06, cz, 0.06, 0.2));
  const cpu = box(x, y, z, 0.15, 0.17, 0.05, 0.3, 0.06, 0.3, 0.02);
  // İşlemcinin bacakları: her yanda küçük çıkıntılar
  let legs = Infinity;
  for (let i = -3; i <= 3; i++) {
    const o = i * 0.075;
    legs = union(legs,
      box(x, y, z, 0.15 + o, 0.14, 0.05 - 0.34, 0.015, 0.03, 0.05),
      box(x, y, z, 0.15 + o, 0.14, 0.05 + 0.34, 0.015, 0.03, 0.05),
      box(x, y, z, 0.15 - 0.34, 0.14, 0.05 + o, 0.05, 0.03, 0.015),
      box(x, y, z, 0.15 + 0.34, 0.14, 0.05 + o, 0.05, 0.03, 0.015));
  }
  const chip = box(x, y, z, -0.55, 0.15, 0.38, 0.2, 0.04, 0.12, 0.01);
  const caps = union(
    cylinder(x, y, z, -0.62, 0.38, -0.32, 0.13, 0.27),
    cylinder(x, y, z, -0.3, 0.3, -0.45, 0.09, 0.19),
    cylinder(x, y, z, 0.72, 0.33, 0.48, 0.1, 0.22),
  );
  let pins = Infinity;
  for (let i = 0; i < 8; i++) pins = union(pins, box(x, y, z, -0.2 + i * 0.13, 0.32, -0.6, 0.022, 0.22, 0.022));
  const header = box(x, y, z, 0.25, 0.17, -0.6, 0.55, 0.06, 0.07, 0.01);
  const usb = subtract(box(x, y, z, 0.88, 0.2, -0.05, 0.16, 0.09, 0.2, 0.01), box(x, y, z, 1.0, 0.2, -0.05, 0.12, 0.04, 0.15));
  return union(board, cpu, legs, chip, caps, pins, header, usb);
}

/** Dişli: 14 dişli çark, göbek deliği ve hafifletme delikleri; üstünde ikinci küçük dişli */
function gear(x: number, y: number, z: number): number {
  const r = Math.hypot(x, z);
  const a = Math.atan2(z, x);
  const tooth = (n: number, base: number, depth: number) => base + depth * Math.max(-1, Math.min(1, Math.cos(n * a) * 2.5));
  let big = Math.max(r - tooth(14, 0.98, 0.1), Math.abs(y - 0.22) - 0.22);
  big = subtract(big, cylinder(x, y, z, 0, 0.22, 0, 0.2, 0.4));
  for (let i = 0; i < 5; i++) {
    const t = (i / 5) * Math.PI * 2;
    big = subtract(big, cylinder(x, y, z, Math.cos(t) * 0.58, 0.22, Math.sin(t) * 0.58, 0.15, 0.4));
  }
  const hub = subtract(cylinder(x, y, z, 0, 0.6, 0, 0.32, 0.2), cylinder(x, y, z, 0, 0.6, 0, 0.2, 0.4));
  let small = Math.max(r - tooth(9, 0.55, 0.08), Math.abs(y - 0.95) - 0.16);
  small = subtract(small, cylinder(x, y, z, 0, 0.95, 0, 0.2, 0.4));
  return union(big, hub, small);
}

/** Burgulu vazo: altı dilimli, yükseldikçe dönen ince cidarlı gövde (vazo modu baskıları gibi) */
function vase(x: number, y: number, z: number): number {
  const r = Math.hypot(x, z);
  const a = Math.atan2(z, x);
  const t = Math.max(0, Math.min(2.2, y));
  // Gövde: dipte orta, ortada şişkin, yukarıda daralan boyun ve hafif açılan ağız
  const lip = Math.max(0, (t - 1.85) / 0.35);
  const profile = 0.3 + 0.38 * Math.max(0, Math.sin(t * 1.3 + 0.25)) + 0.16 * lip * lip;
  const radius = profile * (1 + 0.14 * Math.cos(6 * (a + t * 0.8)));
  const wall = Math.max(Math.abs(r - radius) - 0.045, y - 2.2, -y);
  const floor = Math.max(r - radius, y - 0.08, -y);
  return Math.min(wall, floor);
}

/** Robot: kafa (göz ve ağız boşlukları), anten, boyun, gövde (ekranlı) ve kollar */
function robot(x: number, y: number, z: number): number {
  const head = subtract(
    subtract(
      subtract(box(x, y, z, 0, 1.55, 0, 0.58, 0.42, 0.48, 0.14), sphere(x, y, z, -0.22, 1.62, 0.5, 0.13)),
      sphere(x, y, z, 0.22, 1.62, 0.5, 0.13),
    ),
    box(x, y, z, 0, 1.36, 0.5, 0.24, 0.035, 0.1),
  );
  const antenna = union(cylinder(x, y, z, 0, 2.08, 0, 0.035, 0.12), sphere(x, y, z, 0, 2.24, 0, 0.09));
  const ears = union(cylinder(x, y, z, -0.62, 1.55, 0, 0.12, 0.1), cylinder(x, y, z, 0.62, 1.55, 0, 0.12, 0.1));
  const neck = cylinder(x, y, z, 0, 1.06, 0, 0.16, 0.1);
  const body = subtract(box(x, y, z, 0, 0.5, 0, 0.68, 0.46, 0.44, 0.12), box(x, y, z, 0, 0.58, 0.44, 0.3, 0.17, 0.06));
  const arms = union(box(x, y, z, -0.84, 0.52, 0, 0.1, 0.36, 0.12, 0.06), box(x, y, z, 0.84, 0.52, 0, 0.1, 0.36, 0.12, 0.06));
  return union(head, antenna, ears, neck, body, arms);
}

/** Kapsül: a–b doğru parçasına uzaklık eksi yarıçap */
function capsule(x: number, y: number, z: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, r: number) {
  const px = x - ax, py = y - ay, pz = z - az;
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const t = Math.max(0, Math.min(1, (px * dx + py * dy + pz * dz) / (dx * dx + dy * dy + dz * dz)));
  return Math.hypot(px - dx * t, py - dy * t, pz - dz * t) - r;
}

const smoothstep = (a: number, b: number, t: number) => {
  const u = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

/** Pet şişe: beş ayaklı taban, etiket oyukları, omuz, boğaz halkası ve tırtıklı kapak (ince cidarlı gövde) */
function bottle(x: number, y: number, z: number): number {
  const r = Math.hypot(x, z);
  const a = Math.atan2(z, x);
  // Gövde yarıçapı yüksekliğe göre: taban ayakları, düz gövde, omuzdan boğaza daralma
  let radius = 0.46;
  if (y < 0.22) radius = 0.4 + 0.06 * smoothstep(0, 0.22, y) + 0.05 * Math.cos(5 * a) * (1 - smoothstep(0.05, 0.22, y));
  radius -= 0.025 * (Math.exp(-((y - 0.75) ** 2) / 0.002) + Math.exp(-((y - 1.05) ** 2) / 0.002)); // etiket oyukları
  radius = radius - (0.46 - 0.16) * smoothstep(1.32, 1.82, y);
  const body = Math.max(Math.abs(r - radius) - 0.035, y - 1.95, -y);
  const floor = Math.max(r - radius, y - 0.06, -y);
  const ring = cylinder(x, y, z, 0, 1.9, 0, 0.23, 0.02);
  const cap = Math.max(r - (0.2 + 0.012 * Math.cos(28 * a)), Math.abs(y - 2.07) - 0.13);
  return union(body, floor, ring, cap);
}

/** Rüzgâr türbini: taban, incelen kule, gövde, göbek ve öne bakan üç kanat */
function windTurbine(x: number, y: number, z: number): number {
  const hubY = 1.55;
  const base = cylinder(x, y, z, 0, 0.05, 0, 0.42, 0.05);
  const towerR = 0.12 - 0.05 * Math.max(0, Math.min(1, y / hubY));
  const tower = Math.max(Math.hypot(x, z) - towerR, -y, y - hubY);
  const nacelle = box(x, y, z, 0, hubY, 0.02, 0.1, 0.09, 0.24, 0.05);
  const hub = sphere(x, y, z, 0, hubY, 0.3, 0.1);
  let blades = Infinity;
  for (const deg of [90, 210, 330]) {
    const t = (deg * Math.PI) / 180;
    // Noktayı kanadın kendi eksenine çevir (kanatlar z = 0.3 düzleminde, göbekten dışa)
    const px = x * Math.cos(t) + (y - hubY) * Math.sin(t);
    const py = -x * Math.sin(t) + (y - hubY) * Math.cos(t);
    const width = 0.07 - 0.035 * Math.max(0, Math.min(1, px / 0.8)); // uca doğru incelir
    blades = Math.min(blades, box(px, py, z, 0.44, 0, 0.3, 0.38, width, 0.022, 0.015));
  }
  return union(base, tower, nacelle, hub, blades);
}

/** Protez el: bilek, avuç, eklem boşluklu dört parmak ve yana açılan başparmak */
function prostheticHand(x: number, y: number, z: number): number {
  const wrist = cylinder(x, y, z, 0, 0.28, 0, 0.27, 0.28);
  const palm = box(x, y, z, 0, 0.92, 0, 0.38, 0.38, 0.13, 0.09);
  let fingers = Infinity;
  const lengths = [0.58, 0.68, 0.64, 0.5];
  [-0.27, -0.09, 0.09, 0.27].forEach((fx, i) => {
    const top = 1.32 + lengths[i];
    // Üç bölüm, aralarında eklem boşluğu
    const seg = lengths[i] / 3;
    for (let k = 0; k < 3; k++) {
      const y0 = 1.32 + k * seg + 0.025, y1 = Math.min(top, 1.32 + (k + 1) * seg - 0.025);
      fingers = Math.min(fingers, capsule(x, y, z, fx, y0, 0, fx, y1, 0, 0.075 - k * 0.006));
    }
  });
  const thumb = union(
    capsule(x, y, z, 0.36, 0.78, 0.02, 0.56, 1.08, 0.06, 0.08),
    capsule(x, y, z, 0.6, 1.14, 0.07, 0.72, 1.38, 0.08, 0.07),
  );
  return union(wrist, palm, fingers, thumb);
}

export const PRINT_MODELS: PrintModelDef[] = [
  { name: 'kafatası', height: 2.3, sdf: skull },
  { name: '3B yazıcı', height: 2.14, sdf: printer },
  { name: 'devre kartı', height: 0.56, sdf: circuitBoard },
  { name: 'dişli', height: 1.12, sdf: gear },
  { name: 'vazo', height: 2.2, sdf: vase },
  { name: 'robot', height: 2.34, sdf: robot },
  { name: 'pet şişe', height: 2.2, sdf: bottle },
  { name: 'rüzgâr türbini', height: 2.38, sdf: windTurbine },
  { name: 'protez el', height: 2.05, sdf: prostheticHand },
];

export const modelByName = (name: string) => PRINT_MODELS.find((m) => m.name === name);
