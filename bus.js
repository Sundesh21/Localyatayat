import * as THREE from 'three';

const M = {
  blue:   new THREE.MeshStandardMaterial({ name: 'body_green', color: '#54b634', roughness: 0.34, metalness: 0.18 }),
  white:  new THREE.MeshStandardMaterial({ name: 'body_white', color: '#eef0ea', roughness: 0.4,  metalness: 0.08 }),
  black:  new THREE.MeshStandardMaterial({ name: 'trim_black', color: '#15171a', roughness: 0.35, metalness: 0.15 }),
  cream:  new THREE.MeshStandardMaterial({ name: 'cream',      color: '#e6e0cd', roughness: 0.55, metalness: 0.05 }),
  glass:  new THREE.MeshStandardMaterial({ name: 'glass',      color: '#12161b', roughness: 0.1,  metalness: 0.35, transparent: true, opacity: 0.82 }),
  rubber: new THREE.MeshStandardMaterial({ name: 'rubber',     color: '#1b1c22', roughness: 0.9,  metalness: 0.0 }),
  steel:  new THREE.MeshStandardMaterial({ name: 'steel',      color: '#b8bcc6', roughness: 0.35, metalness: 0.35 }),
  lamp:   new THREE.MeshStandardMaterial({ name: 'lamp',       color: '#ffe9b8', roughness: 0.2,  metalness: 0.1, emissive: '#6b5a2a' }),
  red:    new THREE.MeshStandardMaterial({ name: 'lamp_red',   color: '#c0392b', roughness: 0.3,  metalness: 0.1, emissive: '#3a0f0a' }),
};

const box = (name, w, h, d, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.name = name; m.position.set(x, y, z); return m;
};
const cyl = (name, rt, rb, h, mat, seg = 40) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.name = name; return m;
};

// Bus: length along Z (11.2 m), width 2.5 m, roof at 3.35 m
const L = 11.2, W = 2.5;

export function buildBus() {
  const bus = new THREE.Group();
  bus.name = 'haryana_roadways_bus';
  const wheels = [];

  // ── chassis + skirt
  bus.add(box('skirt', W - 0.06, 0.62, L - 0.5, M.white, 0, 0.78, 0));
  bus.add(box('chassis_rail', W - 0.5, 0.18, L - 0.2, M.rubber, 0, 0.5, 0));

  // ── lower body (blue) and window band
  bus.add(box('body_lower', W, 1.05, L, M.white, 0, 1.62, 0));
  bus.add(box('body_core', W - 0.12, 1.0, L - 0.04, M.rubber, 0, 2.62, 0));   // dark interior shell behind glass
  bus.add(box('body_upper', W, 0.5, L, M.blue, 0, 3.36, 0));

  // pillars between windows (cream) — 7 bays a side
  for (let i = -3; i <= 3; i++) {
    bus.add(box(`pillar_${i + 4}`, W + 0.012, 1.02, 0.14, M.black, 0, 2.62, i * 1.32));
  }
  // window glass panes, both sides
  for (let s of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const z = -3.96 + 0.66 + i * 1.32;
      bus.add(box(`window_${s < 0 ? 'L' : 'R'}${i + 1}`, 0.04, 0.94, 1.14, M.glass, s * (W / 2 + 0.005), 2.62, z));
    }
    // rear-most short pane
    bus.add(box(`window_${s < 0 ? 'L' : 'R'}7`, 0.04, 0.94, 1.0, M.glass, s * (W / 2 + 0.005), 2.62, 4.5));
  }

  // ── waist trim + a solid accent stripe
  bus.add(box('waist_trim', W + 0.03, 0.1, L - 0.02, M.blue, 0, 2.08, 0));
  // green chevron bars on the white lower panel, toward the rear axle
  for (let s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      bus.add(box(`bar_${s < 0 ? 'L' : 'R'}${i + 1}`, 0.03, 0.1, 0.95 - i * 0.12, M.blue,
        s * (W / 2 + 0.006), 1.32 + i * 0.17, 3.6));
    }
  }

  // ── windshield + rear window
  const wsGeo = new THREE.BoxGeometry(W - 0.24, 1.05, 0.05);
  const ws = new THREE.Mesh(wsGeo, M.glass);
  ws.name = 'windshield'; ws.position.set(0, 2.6, -L / 2 - 0.02); ws.rotation.x = -0.06;
  bus.add(ws);
  bus.add(box('rear_window', W - 0.3, 0.9, 0.05, M.glass, 0, 2.6, L / 2 + 0.02));

  // destination board above windshield
  bus.add(box('destination_board', W - 0.5, 0.34, 0.06, M.blue, 0, 3.32, -L / 2 - 0.03));
  bus.add(box('destination_glass', W - 0.62, 0.22, 0.04, M.glass, 0, 3.32, -L / 2 - 0.07));

  // ── front face: bumper, grille, lamps
  bus.add(box('front_bumper', W + 0.04, 0.34, 0.34, M.steel, 0, 0.72, -L / 2 - 0.12));
  bus.add(box('grille', W - 0.9, 0.3, 0.1, M.black, 0, 1.35, -L / 2 - 0.04));
  bus.add(box('front_mask', W - 0.16, 1.22, 0.04, M.black, 0, 2.6, -L / 2 - 0.005));
  for (let s of [-1, 1]) {
    const hl = cyl(`headlight_${s < 0 ? 'L' : 'R'}`, 0.19, 0.19, 0.12, M.lamp, 32);
    hl.rotation.x = Math.PI / 2; hl.position.set(s * 0.78, 1.28, -L / 2 - 0.06);
    bus.add(hl);
    const ring = cyl(`headlight_ring_${s < 0 ? 'L' : 'R'}`, 0.23, 0.23, 0.07, M.steel, 32);
    ring.rotation.x = Math.PI / 2; ring.position.set(s * 0.78, 1.28, -L / 2 - 0.03);
    bus.add(ring);
    bus.add(box(`indicator_front_${s < 0 ? 'L' : 'R'}`, 0.16, 0.13, 0.08, M.lamp, s * 1.12, 1.62, -L / 2 - 0.04));
    // mirrors
    const arm = cyl(`mirror_arm_${s < 0 ? 'L' : 'R'}`, 0.03, 0.03, 0.5, M.steel, 12);
    arm.rotation.z = Math.PI / 2 * s * -1; arm.position.set(s * 1.45, 2.95, -L / 2 + 0.35);
    bus.add(arm);
    bus.add(box(`mirror_${s < 0 ? 'L' : 'R'}`, 0.06, 0.42, 0.26, M.rubber, s * 1.7, 2.82, -L / 2 + 0.35));
    // tail lamps
    bus.add(box(`taillight_${s < 0 ? 'L' : 'R'}`, 0.16, 0.24, 0.08, M.red, s * 0.9, 1.4, L / 2 + 0.04));
  }
  bus.add(box('rear_bumper', W + 0.02, 0.3, 0.28, M.steel, 0, 0.72, L / 2 + 0.1));

  // ── doors (recessed dark panels, front + middle)
  for (const [n, z] of [['door_front', -3.3], ['door_rear', 1.35]]) {
    bus.add(box(n, 0.05, 1.9, 1.05, M.rubber, -(W / 2 + 0.008), 1.72, z));
    bus.add(box(n + '_glass', 0.04, 0.7, 0.95, M.glass, -(W / 2 + 0.02), 2.4, z));
    bus.add(box(n + '_step', 0.3, 0.1, 0.9, M.steel, -(W / 2 - 0.1), 0.6, z));
  }

  // ── roof: cap, luggage rack, hatches
  bus.add(box('roof', W - 0.05, 0.12, L - 0.06, M.blue, 0, 3.66, 0));
  bus.add(box('roof_edge_L', 0.08, 0.2, L - 0.06, M.blue, -(W / 2 - 0.06), 3.68, 0));
  bus.add(box('roof_edge_R', 0.08, 0.2, L - 0.06, M.blue, (W / 2 - 0.06), 3.68, 0));
  for (let i = 0; i < 2; i++) {
    bus.add(box(`roof_hatch_${i + 1}`, 0.7, 0.07, 0.7, M.steel, 0, 3.75, -2.4 + i * 4.8));
  }
  for (let i = 0; i < 7; i++) {
    bus.add(box(`rack_bar_${i + 1}`, W - 0.3, 0.05, 0.06, M.steel, 0, 3.79, -4.2 + i * 1.4));
  }

  // ── wheels: 2 front, 4 rear (dual)
  const mkWheel = (name, x, z) => {
    const g = new THREE.Group(); g.name = name;
    const tyre = cyl(name + '_tyre', 0.55, 0.55, 0.34, M.rubber, 40);
    tyre.rotation.z = Math.PI / 2;
    const hub = cyl(name + '_hub', 0.24, 0.24, 0.33, M.steel, 24);
    hub.rotation.z = Math.PI / 2;
    const nut = cyl(name + '_cap', 0.08, 0.08, 0.36, M.steel, 12);
    nut.rotation.z = Math.PI / 2;
    g.add(tyre, hub, nut);
    g.position.set(x, 0.52, z);
    return g;
  };
  const axles = [['front', -3.6, 1.12], ['rear_a', 3.1, 1.12], ['rear_b', 3.1 + 0.0, 1.12]];
  wheels.push(mkWheel('wheel_front_L', -1.2, -3.5), mkWheel('wheel_front_R', 1.2, -3.5));
  for (const dz of [2.95, 3.72]) {
    wheels.push(mkWheel(`wheel_rear_L_${dz}`, -1.16, dz), mkWheel(`wheel_rear_R_${dz}`, 1.16, dz));
  }
  wheels.forEach(w => bus.add(w));
  void axles;

  // exhaust + fuel tank
  const ex = cyl('exhaust', 0.07, 0.07, 1.1, M.steel, 16);
  ex.rotation.x = Math.PI / 2; ex.position.set(0.7, 0.42, 4.6);
  bus.add(ex);
  const tank = cyl('fuel_tank', 0.3, 0.3, 1.4, M.steel, 24);
  tank.rotation.z = Math.PI / 2; tank.position.set(-1.1, 0.72, 0.2);
  bus.add(tank);

  // horn trumpets on the roof
  for (let s of [-1, 1]) {
    const h = cyl(`horn_${s < 0 ? 'L' : 'R'}`, 0.13, 0.045, 0.42, M.steel, 20);
    h.rotation.x = -Math.PI / 2; h.position.set(s * 0.35, 3.86, -3.9);
    bus.add(h);
  }

  // ── rear number plate: Ba 1 Ka 6874
  const pc = document.createElement('canvas');
  pc.width = 2048; pc.height = 1024;
  const g2 = pc.getContext('2d');
  g2.scale(4, 4);
  g2.fillStyle = '#b3241c'; g2.fillRect(0, 0, 512, 256);
  g2.strokeStyle = '#f2f2ee'; g2.lineWidth = 10;
  g2.strokeRect(12, 12, 488, 232);
  g2.fillStyle = '#f4f4ef';
  g2.textAlign = 'center'; g2.textBaseline = 'middle';
  g2.font = '700 92px Georgia, serif';
  g2.fillText('Ba 1  Ka', 256, 86);
  g2.font = '700 104px Georgia, serif';
  g2.fillText('6874', 256, 182);
  const tex = new THREE.CanvasTexture(pc);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  const plateMat = new THREE.MeshStandardMaterial({ name: 'number_plate', map: tex, color: '#ffffff', roughness: 0.45, metalness: 0.05 });
  const plateRed = new THREE.MeshStandardMaterial({ name: 'plate_red', color: '#b3241c', roughness: 0.5, metalness: 0.05 });
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 0.04), [
    plateRed, plateRed, plateRed, plateRed, plateMat, plateRed,
  ]);
  plate.name = 'number_plate';
  plate.position.set(0, 1.06, L / 2 + 0.05);
  bus.add(plate);

  return { bus, wheels };
}
