function split(raw, author) {
  var main = (raw || '').split('|')[0].trim();
  var artist = (author || '').replace(/\s*-\s*Topic$/, '');
  var i = main.lastIndexOf(' - ');
  if (i > 0) { artist = main.slice(i + 3).trim(); main = main.slice(0, i).trim(); }
  return { title: main, artist: artist };
}

function keep(list) {
  return list.filter(function (id) { return !BAD[id]; });
}
const assert = require('assert');
const eq = (raw, author, t, a) => {
  const r = split(raw, author);
  assert.strictEqual(r.title, t, `title: got "${r.title}" want "${t}"`);
  assert.strictEqual(r.artist, a, `artist: got "${r.artist}" want "${a}"`);
};

// --- title parsing, against real rows from the playlist ---
eq('Kaslai Sodhne Hola (कसलाई सोध्ने होला) - Bishnu Majhi & Bhagirath Chalaune | New Lok Dohori 2082 | Music Nepal',
   'Music Nepal', 'Kaslai Sodhne Hola (कसलाई सोध्ने होला)', 'Bishnu Majhi & Bhagirath Chalaune');
eq('Maya', 'Pramod Kharel - Topic', 'Maya', 'Pramod Kharel');
eq('Sare Sare (From "Bir Bikram")', 'Tara Prakash Limbu - Topic', 'Sare Sare (From "Bir Bikram")', 'Tara Prakash Limbu');
eq('Hongkong Pokhara', 'Bibek Shrestha - Topic', 'Hongkong Pokhara', 'Bibek Shrestha');
eq('By By Maya', '', 'By By Maya', '');

// --- blocklist filtering ---
var BAD = {};
assert.deepStrictEqual(keep(['a','b','c']), ['a','b','c']);      // nothing blocked
BAD = {b:1};
assert.deepStrictEqual(keep(['a','b','c']), ['a','c']);          // drops the bad one
BAD = {a:1,b:1,c:1};
// all bad -> empty, NOT the original list. Handing the unfiltered list back is
// what let known-dead videos (the error-150 ones) return to the player.
assert.deepStrictEqual(keep(['a','b','c']), []);
BAD = {};

// --- videos.list filtering: only public + embeddable ids survive, in order ---
function playable(ids, items) {
  const ok = {}, present = {};
  items.forEach(v => {
    present[v.id] = 1;
    if (v.status.privacyStatus === 'private' || !v.status.embeddable) return;
    ok[v.id] = 1;
  });
  return { keep: ids.filter(id => ok[id]), missing: ids.filter(id => !present[id]) };
}
const r = playable(['a','b','c','d'], [
  { id: 'a', status: { embeddable: true,  privacyStatus: 'public'  } },
  { id: 'b', status: { embeddable: false, privacyStatus: 'public'  } },   // embedding off
  { id: 'c', status: { embeddable: true,  privacyStatus: 'private' } },   // private
]);                                                                        // d: deleted, absent
assert.deepStrictEqual(r.keep, ['a'], 'only confirmed embeddable public videos may play');
assert.deepStrictEqual(r.missing, ['d'], 'ids missing from the response are deleted');

// --- which YouTube errors are the song's fault ---
const perm = d => (d === 100 || d === 101 || d === 150);
[100,101,150].forEach(d => assert.ok(perm(d),  `error ${d} should drop the song`));
[2,5,153].forEach(d => assert.ok(!perm(d), `error ${d} is a page problem, must NOT drop the song`));

function shuffle(a) {
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1)), t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

// --- shuffle: must be a permutation, never lose or duplicate a song ---
const src = Array.from({length:45}, (_,i) => 'id'+i);
for (let n = 0; n < 200; n++) {
  const got = shuffle(src.slice());
  assert.strictEqual(got.length, src.length, 'shuffle changed the track count');
  assert.deepStrictEqual([...got].sort(), [...src].sort(), 'shuffle lost or duplicated a track');
}
// and it must actually reorder (45! makes a false failure vanishingly unlikely)
assert.ok(Array.from({length:20}, () => shuffle(src.slice()).join()).some(o => o !== src.join()),
          'shuffle never changed the order');

// --- skip buttons: index wraps both ways, so prev at the top goes to the end ---
const wrap = (n, len) => (n + len) % len;
assert.strictEqual(wrap(0 - 1, 45), 44, 'prev at the first track must wrap to the last');
assert.strictEqual(wrap(44 + 1, 45), 0, 'next at the last track must wrap to the first');
assert.strictEqual(wrap(3 + 1, 45), 4);
assert.strictEqual(wrap(3 - 1, 45), 2);

// --- dashboard: speed easing, status thresholds, road-loop formula ---
const CRUISE = 54, STATUS = ['depot', 'pulling', 'highway'];
const step = k => { const d = k.want - k.at; k.at = Math.abs(d) < 0.4 ? k.want : k.at + d * 0.05; return k; };
const label = v => STATUS[v < 1 ? 0 : v < 32 ? 1 : 2];
const metres = (at, dt) => (at / 3.6) * dt;   // km/h -> metres this frame

// pulling away: converges up to cruise, never overshoots
let k = { at: 0, want: CRUISE }, n = 0;
while (k.at !== CRUISE && n++ < 5000) { step(k); assert.ok(k.at <= CRUISE, 'speed overshot cruise'); }
assert.strictEqual(k.at, CRUISE, 'never reached cruise speed');
assert.ok(n < 400, `took ${n} ticks (~${(n * 0.09).toFixed(1)}s) to reach cruise — too slow`);

// braking: converges back to a dead stop, never below zero
k = { at: CRUISE, want: 0 }; n = 0;
while (k.at !== 0 && n++ < 5000) { step(k); assert.ok(k.at >= 0, 'speed went negative'); }
assert.strictEqual(k.at, 0, 'never came to a full stop');

assert.strictEqual(label(0), 'depot');
assert.strictEqual(label(31), 'pulling');
assert.strictEqual(label(32), 'highway');
assert.strictEqual(label(CRUISE), 'highway');

// The 3D stage converts the speedometer to metres travelled per frame, then
// scrolls the highway tiles and rolls the wheels by that distance.
assert.strictEqual(metres(0, 0.016), 0, 'a stopped bus must not move the road');
assert.ok(metres(54, 1) > 14.9 && metres(54, 1) < 15.1, '54 km/h should be ~15 m/s');
for (let v = 0; v < CRUISE; v++) {
  assert.ok(metres(v + 1, 0.016) > metres(v, 0.016), `road not scrolling faster at ${v} km/h`);
}
// wheel radius 0.55 m in bus.js — one revolution per 2*pi*r metres
const WHEEL_R = 0.55;
const revs = m => m / WHEEL_R / (2 * Math.PI);
assert.ok(Math.abs(revs(2 * Math.PI * WHEEL_R) - 1) < 1e-9, 'wheel must turn exactly once per circumference');

console.log('all checks passed');
