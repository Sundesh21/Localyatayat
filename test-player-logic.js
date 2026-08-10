function split(raw, author) {
  var main = (raw || '').split('|')[0].trim();
  var artist = (author || '').replace(/\s*-\s*Topic$/, '');
  var i = main.lastIndexOf(' - ');
  if (i > 0) { artist = main.slice(i + 3).trim(); main = main.slice(0, i).trim(); }
  return { title: main, artist: artist };
}

function keep(list) {
  var out = list.filter(function (id) { return !BAD[id]; });
  return out.length ? out : list;      // never end up with an empty player
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
assert.deepStrictEqual(keep(['a','b','c']), ['a','b','c']);      // all bad -> fall back, never empty

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

console.log('all checks passed');
