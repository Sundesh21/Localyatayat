import * as THREE from 'three';

const mat = (name, color, o = {}) =>
  new THREE.MeshStandardMaterial({ name, color, roughness: 0.85, metalness: 0.0, ...o });

const E = {
  asphalt: mat('asphalt', '#33363f', { roughness: 0.95 }),
  line:    mat('road_line', '#d8d3c2', { polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
  kerb:    mat('kerb', '#8d8779'),
  grass:   mat('hill_green', '#3f5a38'),
  grass2:  mat('terrace_green', '#4d6b40'),
  rock:    mat('rock', '#5d5749'),
  pine:    mat('pine', '#22381f'),
  trunk:   mat('trunk', '#3a2c22'),
  snow:    mat('snow', '#dfe6ee', { roughness: 0.6 }),
  ridge:   mat('ridge', '#4a5470'),
  ridge2:  mat('ridge_far', '#5d668a'),
  flag:    [mat('flag_blue', '#3f6fbf'), mat('flag_white', '#dcdcd6'), mat('flag_red', '#c1443a'),
            mat('flag_green', '#3f8f5c'), mat('flag_yellow', '#d9b64a')],
  post:    mat('guard_post', '#9a9aa2', { metalness: 0.3, roughness: 0.4 }),
};

const box = (name, w, h, d, m, x, y, z) => {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.name = name; o.position.set(x, y, z); return o;
};
const cone = (name, r, h, m, x, y, z, seg = 5) => {
  const o = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), m);
  o.name = name; o.position.set(x, y, z); return o;
};

const TILE = 24, TILES = 11, ROAD_Y = -0.04;

const DEV_FONT = '"Noto Sans Devanagari","Kohinoor Devanagari","Nirmala UI",Mangal,sans-serif';

// Which tile carries which board: [name, Devanagari line, Latin line]
const SIGNS = {
  4: ['sign_mugling', 'मुग्लिन ८० कि.मि.', 'MUGLIN  80 km'],
  0: ['sign_pokhara', 'पोखरा १५० कि.मि.', 'POKHARA  150 km'],
};

/** Pick the largest font size that still fits `max` px wide. Devanagari metrics
 *  vary a lot across the system fonts this falls back to, so a fixed size clips
 *  on some machines. */
function fitFont(g, text, start, max, family) {
  let size = start;
  g.font = `700 ${size}px ${family}`;
  while (g.measureText(text).width > max && size > 24) {
    size -= 4;
    g.font = `700 ${size}px ${family}`;
  }
}

/** Distance board: black on yellow, two posts, facing oncoming traffic (+Z). */
function signboard(name, devLine, latinLine) {
  // 2048x896, double the old size — these are read at a glance as they rush past,
  // and the smaller texture went soft. Laid out as fractions of W/H so the numbers
  // stay in step with the canvas.
  const W = 2048, H = 896, FIT = W * 0.84;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = '#f0c02f';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#15150f';
  g.lineWidth = W * 0.0156;
  g.strokeRect(W * 0.023, H * 0.054, W * 0.954, H * 0.893);
  g.fillStyle = '#15150f';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  // fitFont only knows what measureText reports for the font resolved right now,
  // and devices resolve different Devanagari faces. The maxWidth argument is what
  // actually guarantees the line cannot overrun the canvas and get clipped.
  fitFont(g, devLine, H * 0.335, FIT, DEV_FONT);
  g.fillText(devLine, W / 2, H * 0.368, FIT);
  fitFont(g, latinLine, H * 0.272, FIT, 'Arial, Helvetica, sans-serif');
  g.fillText(latinLine, W / 2, H * 0.683, FIT);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  const face = new THREE.MeshStandardMaterial({ name: 'sign_face', map: tex, roughness: 0.6, metalness: 0.05 });
  const edge = mat('sign_edge', '#c8a029', { roughness: 0.6 });

  const s = new THREE.Group();
  s.name = name;
  // BoxGeometry material order is [+X,-X,+Y,-Y,+Z,-Z]; index 4 is the front face,
  // the same trick bus.js uses for the number plate.
  const board = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.15, 0.1),
    [edge, edge, edge, edge, face, edge]);
  board.name = name + '_board';
  board.position.set(0, ROAD_Y + 2.75, 0);
  s.add(board);
  for (const sx of [-0.9, 0.9]) {
    s.add(box(`${name}_post`, 0.12, 2.4, 0.12, E.post, sx, ROAD_Y + 1.2, 0));
  }
  return s;
}

function pine(x, z, s = 1) {
  const g = new THREE.Group(); g.name = 'pine_tree';
  g.add(box('trunk', 0.22 * s, 1.1 * s, 0.22 * s, E.trunk, 0, 0.55 * s, 0));
  g.add(cone('needles_low', 1.5 * s, 3.0 * s, E.pine, 0, 2.2 * s, 0, 7));
  g.add(cone('needles_top', 1.0 * s, 2.4 * s, E.pine, 0, 3.9 * s, 0, 7));
  g.position.set(x, ROAD_Y, z);
  return g;
}

function tile(i) {
  const g = new THREE.Group();
  g.name = `highway_tile_${i}`;
  // carriageway + shoulders
  g.add(box('road', 9, 0.12, TILE, E.asphalt, 0, ROAD_Y - 0.06, 0));
  g.add(box('shoulder_L', 1.6, 0.1, TILE, E.kerb, -5.2, ROAD_Y - 0.07, 0));
  g.add(box('shoulder_R', 1.6, 0.1, TILE, E.kerb, 5.2, ROAD_Y - 0.07, 0));
  // centre dashes
  for (let d = 0; d < 4; d++) {
    g.add(box(`dash_${d}`, 0.18, 0.03, 3.2, E.line, 0, ROAD_Y + 0.022, -TILE / 2 + 3 + d * 6));
  }
  g.add(box('edge_line_L', 0.12, 0.03, TILE + 0.01, E.line, -4.1, ROAD_Y + 0.022, 0));
  g.add(box('edge_line_R', 0.12, 0.03, TILE + 0.01, E.line, 4.1, ROAD_Y + 0.022, 0));

  // right side: an open plain instead of stepped terraces. Trees and the distant
  // range carry this side now, so the ground itself stays flat and low.
  g.add(box('plain', 60, 0.4, TILE, E.grass, 36, ROAD_Y - 0.26, 0));
  g.add(box('verge_R', 2.6, 0.14, TILE, E.grass2, 7.6, ROAD_Y - 0.05, 0));

  // Gentle rises, spaced out by tile index, so the flat never reads as a table
  // top. These ride the tiles, so unlike the static range they parallax properly.
  if (i % 3 === 0) g.add(cone('knoll', 9, 3.2, E.grass2, 26, ROAD_Y - 0.2, -TILE / 6, 7));
  if (i % 4 === 2) g.add(cone('knoll_far', 15, 5.4, E.grass, 47, ROAD_Y - 0.2, TILE / 5, 7));
  if (i % 5 === 3) g.add(box('outcrop', 2.4, 1.6, 3.2, E.rock, 12, ROAD_Y + 0.6, 0));

  // left side: the drop into the valley
  g.add(box('valley_shelf', 10, 0.5, TILE, E.grass, -10, ROAD_Y - 0.9, 0));
  g.add(box('valley_slope', 8, 6, TILE, E.grass, -17, ROAD_Y - 3.4, 0));
  g.add(box('valley_wall', 30, 22, TILE, E.ridge, -36, ROAD_Y - 12.5, 0));

  // guardrail on the valley side
  for (let p = 0; p < 5; p++) {
    g.add(box(`guard_post_${p}`, 0.12, 0.9, 0.12, E.post, -5.9, ROAD_Y + 0.45, -TILE / 2 + 2.4 + p * 4.8));
  }
  g.add(box('guard_rail', 0.06, 0.2, TILE - 0.6, E.post, -5.9, ROAD_Y + 0.8, 0));

  // trees + a milestone, varied per tile so the loop doesn't read as a loop
  if (i % 2 === 0) g.add(pine(-8.4, -TILE / 4, 0.9));
  if (i % 3 === 0) g.add(pine(-11.5, TILE / 5, 1.25));
  // right side: a scattering out across the plain, bigger further back so the
  // depth reads even where the ground is flat
  g.add(pine(9.4, -TILE / 3, 1.0));
  if (i % 2 === 0) g.add(pine(14.5, TILE / 4, 1.2));
  if (i % 3 === 1) g.add(pine(21, -TILE / 5, 1.35));
  if (i % 2 === 1) g.add(pine(31, TILE / 3, 1.55));
  if (i % 4 === 0) g.add(pine(41, -TILE / 4, 1.8));
  if (i % 4 === 1) {
    g.add(box('milestone', 0.5, 0.7, 0.22, E.line, 5.6, ROAD_Y + 0.35, 0));
    g.add(box('milestone_cap', 0.52, 0.18, 0.24, E.flag[2], 5.6, ROAD_Y + 0.78, 0));
  }
  // Distance boards on the right verge. Tiles are laid out at z = -120 + i*24 and
  // scroll toward the camera, so lower indices are reached later: tile 4 puts
  // Mugling a few seconds out, tile 0 puts Pokhara ~96 m (about 6 s at cruise)
  // beyond it. Clear of the pine at z = -TILE/3 and of the outcrop at z = 0.
  if (SIGNS[i]) {
    const s = signboard(...SIGNS[i]);
    s.position.set(8, 0, 5);
    g.add(s);
  }
  // prayer-flag strand across the road, now and then
  if (i % 5 === 2) {
    const s = new THREE.Group(); s.name = 'prayer_flags';
    s.add(box('flag_pole_L', 0.12, 6.6, 0.12, E.trunk, -6.4, ROAD_Y + 3.3, 0));
    s.add(box('flag_pole_R', 0.12, 6.6, 0.12, E.trunk, 6.4, ROAD_Y + 3.3, 0));
    for (let f = 0; f < 13; f++) {
      const x = -5.8 + f * 0.97;
      const sag = 0.34 * Math.cos((x / 6.4) * Math.PI / 2 + Math.PI) + 0.34;
      s.add(box(`flag_${f}`, 0.62, 0.44, 0.02, E.flag[f % 5], x, ROAD_Y + 6.1 - (0.34 - sag), 0));
    }
    g.add(s);
  }
  return g;
}

/** Distant Himalaya: static, far away, never scrolls. */
function himalaya() {
  const g = new THREE.Group(); g.name = 'himalaya';
  // [x, height, radius, z] — right-hand entries (+x) fill the side the terraces
  // used to occupy. Kept beyond ~220m so standing still reads as distance rather
  // than as a bug; the per-tile knolls provide the near parallax.
  const peaks = [
    [-70, 34, 26, -210], [-24, 52, 34, -240], [18, 44, 30, -225],
    [64, 60, 40, -260], [116, 38, 28, -235], [-130, 46, 32, -255],
    [58, 30, 26, -228], [104, 44, 36, -268], [152, 36, 30, -244], [186, 28, 24, -222],
  ];
  peaks.forEach(([x, h, r, z], i) => {
    g.add(cone(`peak_${i}`, r, h, E.ridge2, x, h / 2 - 6, z, 5));
    g.add(cone(`peak_snow_${i}`, r * 0.44, h * 0.42, E.snow, x, h - h * 0.42 / 2 - 6, z, 5));
  });
  // mid ridge line
  for (let i = 0; i < 9; i++) {
    g.add(cone(`ridge_${i}`, 30, 16, E.ridge, -160 + i * 42, 2, -150, 4));
  }
  return g;
}

export function buildHighway(scene) {
  const road = new THREE.Group();
  road.name = 'highway';
  const tiles = [];
  for (let i = 0; i < TILES; i++) {
    const t = tile(i);
    t.position.z = -TILE * (TILES - 1) / 2 + i * TILE;
    tiles.push(t); road.add(t);
  }
  scene.add(road);
  scene.add(himalaya());
  scene.fog = new THREE.Fog('#8fa2bd', 60, 300);

  const span = TILE * TILES;
  return function advance(metres) {
    for (const t of tiles) {
      t.position.z += metres;
      if (t.position.z > span / 2) t.position.z -= span;
      else if (t.position.z < -span / 2) t.position.z += span;
    }
  };
}
