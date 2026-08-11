(function () {
  // support.js re-creates <helmet> scripts inside <head>, so this file runs twice:
  // once from the tag in the body, once from the clone. That left two players
  // fighting over #np-yt with separate shuffles, watchdogs and error handlers —
  // tracks jumping, doubled blocklisting, and a play button wired to whichever
  // copy had no player. Whoever gets here first wins.
  if (window.__npLoaded) return;
  window.__npLoaded = true;

  // "Local Bus Songs". With an API key the track list is read from YouTube at load,
  // so songs you add there show up here. Without one it falls back to SEED below.
  //
  // Get a key: console.cloud.google.com -> new project -> enable "YouTube Data API
  // v3" -> Credentials -> Create API key. Then restrict it: Application
  // restrictions = Websites, add your domain. The key is public in this file by
  // design; the referrer lock is what protects it. Read-only, 10k units/day, this
  // page costs ~2 per load.
  var PLAYLIST = 'PLLxpFTKZn2m4';
  var API_KEY  = 'AIzaSyC5PC5mpu-cSvdSS0picxAAcOq2BNpZidk';

  // Where the Data API calls go. Empty = straight to googleapis with the key
  // above. To move the key server-side on Vercel later, add an /api/youtube
  // function that forwards `path` + the remaining query string to
  // googleapis.com/youtube/v3 with process.env.YT_API_KEY, then set:
  //   var API_PROXY = '/api/youtube';
  // and blank out API_KEY. Nothing else in this file changes — every request
  // already goes through get() below.
  var API_PROXY = '';

  // Fallback list, scraped 2026-08-10. Only used when API_KEY is empty or the API
  // call fails, so the bar still works — but it goes stale as you add songs.
  var SEED = ('wxmehzGmN9s lk7BxjtcyOI Aamfn3EbwRY AQOePOhaQbY 8XREXBOz-uA FCuexgI4-1c 8y8RY8B7ysc ' +
    'egUCvaH6lBU 1wDTlODN3EQ JFpK7Aftbq0 n_Q0wKciERU Wq2OUZeOWzI AUt3eBCJGtM c28vnSbz4vM d9KhkkDyo-0 ' +
    '3Fvr3O_04xg Lbvu2MzXThg ULRRhP4lJJI QDmpje6sZAA UOCNEwoJtS0 PTVkQJLiDRk HCkKWDyD6QE Lb5z3z6mePM ' +
    'wI-vd4b7lQk dZ8F53AnneI OyRsGmJ4S-I Hl2lnqYvheY DqN0PhgGgWg uz_owah2x28 5wxm1PAv3cE KnZmRLmfRV4 ' +
    'JolHTx7keZQ nd8i8qEkmiQ 0ESbyyvSjCQ 9YTwUq3tO2M SHkPWbcLQLI vsCicatFEew FIFnap6epu0 KbPpYnPotGY ' +
    '1evIx_F-0I4 AxmU5eI3-TM ohVlUzX5abo oHA9pNK1xL8 Xt-7UhRCDmc mRBhF994L-g').split(' ');

  // Songs to drop by hand — paste a video id in here and it never gets queued.
  var DROP = [];

  // Songs dropped automatically. A track is only recorded here when YouTube says
  // the video itself is the problem: 100 = deleted/private, 101 & 150 = the owner
  // disabled embedding. Errors 2, 5 and 153 are player/page problems, not the
  // song's fault, so they never blocklist anything — otherwise one bad page load
  // (e.g. opening over file://) would wipe out the whole playlist permanently.
  // To reset: localStorage.removeItem('np-blocked')
  var KEY = 'np-blocked', BAD = {};
  try { (JSON.parse(localStorage.getItem(KEY) || '[]')).forEach(function (i) { BAD[i] = 1; }); } catch (e) {}
  DROP.forEach(function (i) { BAD[i] = 1; });

  function blocklist(id) {
    if (BAD[id]) return;
    BAD[id] = 1;
    try {
      localStorage.setItem(KEY, JSON.stringify(Object.keys(BAD)));
    } catch (e) {}
  }

  var el = {}, yt = null, playing = false, curId = null;
  var IDS = [], idx = 0, misses = 0, everPlayed = false;
  // `muted` = visitor pressed pause; `kicked` = someone has interacted, so audio is
  // allowed to start and the stall watchdog is armed.
  var muted = false, kicked = false, lastT = -1, stalled = 0;

  function fmt(s) {
    s = Math.max(0, Math.floor(s || 0));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  // Raw YouTube titles are messy ("Song - Artist | Label | 2082"). Trim everything
  // after the first pipe, then split off the artist. `- Topic` channels are YouTube's
  // auto-generated album uploads and already have a clean title + artist.
  function split(raw, author) {
    var main = (raw || '').split('|')[0].trim();
    var artist = (author || '').replace(/\s*-\s*Topic$/, '');
    var i = main.lastIndexOf(' - ');
    if (i > 0) { artist = main.slice(i + 3).trim(); main = main.slice(0, i).trim(); }
    return { title: main, artist: artist };
  }

  // In API mode `seen` is prefilled from the API's snippet. In SEED mode it starts
  // empty and gets filled lazily from oEmbed (CORS-open, no key needed).
  var seen = {};
  function show(id, m) {
    el.cover.src = 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg';
    el.cover.alt = m.title + ' artwork';
    el.title.textContent = m.title;
    el.artist.textContent = m.artist;
  }

  function paint() {
    var id = IDS[idx];
    if (!id || id === curId) return;
    curId = id;
    if (seen[id]) return show(id, seen[id]);
    fetch('https://www.youtube.com/oembed?format=json&url=' +
          encodeURIComponent('https://www.youtube.com/watch?v=' + id))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) return;
        seen[id] = split(j.title, j.author_name);
        if (curId === id) show(id, seen[id]);        // ignore if we've moved on
      })
      .catch(function () {});
  }

  function go(n) {
    if (!IDS.length) return;
    idx = (n + IDS.length) % IDS.length;   // wraps, so the playlist never runs out
    everPlayed = false;
    lastT = -1;
    stalled = 0;
    paint();
    if (yt) yt.loadVideoById(IDS[idx]);
  }

  // Drop everything the blocklist knows about. This used to hand the *unfiltered*
  // list back when every id was blocked, which quietly put known-dead videos into
  // the player again; callers deal with an empty result instead (see boot()).
  function keep(list) {
    return list.filter(function (id) { return !BAD[id]; });
  }

  // Fisher-Yates, in place. Shuffled once per visit so two people opening the page
  // don't get the same song, and so the order differs on a reload.
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  // One door for every Data API call, so the key lives in exactly one place and
  // can move behind API_PROXY later. Rejects with a message that names the HTTP
  // status — the old version threw a bare 0 and the failure was invisible.
  function get(path, params) {
    var url = API_PROXY
      ? API_PROXY + '?path=' + encodeURIComponent(path) + '&' + params
      : 'https://www.googleapis.com/youtube/v3/' + path + '?key=' + API_KEY + '&' + params;
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(path + ' -> HTTP ' + r.status + ' ' + (r.statusText || ''));
      return r.json();
    });
  }

  // Ask videos.list which of these ids can actually be embedded, and keep only
  // those. Anything the API says has embedding disabled goes on the blocklist
  // right here: that is the same verdict as a YouTube 101/150 at playback time,
  // so recording it now keeps it out of the SEED fallback too. videos.list takes
  // at most 50 ids per call, and it silently omits ids that no longer exist.
  function verify(ids) {
    var chunks = [], i;
    for (i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));
    return Promise.all(chunks.map(function (c) {
      return get('videos', 'part=snippet,status&id=' + c.join(','));
    })).then(function (rs) {
      var ok = {}, seenById = {}, dropped = [];
      rs.forEach(function (r) {
        (r.items || []).forEach(function (v) {
          seenById[v.id] = 1;
          if (v.status.privacyStatus === 'private') { dropped.push(v.id + ' (private)'); return; }
          if (!v.status.embeddable) {
            dropped.push(v.id + ' (embedding disabled)');
            blocklist(v.id);
            return;
          }
          ok[v.id] = true;
          seen[v.id] = split(v.snippet.title, v.snippet.channelTitle);
        });
      });
      ids.forEach(function (id) {
        if (!seenById[id]) { dropped.push(id + ' (deleted/unavailable)'); blocklist(id); }
      });
      if (dropped.length) console.warn('[player] filtered out ' + dropped.length + ' unplayable:', dropped.join(', '));
      return ids.filter(function (id) { return ok[id]; });     // keeps playlist order
    });
  }

  // Read the playlist via the Data API: page through the items, then confirm each
  // one is embeddable before it can reach the player. If any of that fails we fall
  // back to SEED *minus the blocklist* — never the raw array, which is what kept
  // re-feeding known-dead videos like the 150 in the console.
  function loadList(done) {
    var finished = false;
    function finish() { if (!finished) { finished = true; done(); } }

    function fallback(why) {
      IDS = keep(SEED);
      console.warn('[player] ' + why + ' — using the seed list: ' + IDS.length +
                   ' of ' + SEED.length + ' tracks (' + (SEED.length - IDS.length) + ' blocklisted)');
      finish();
    }

    if (!API_KEY && !API_PROXY) return fallback('no Data API key configured');

    var ids = [];
    (function page(token) {
      get('playlistItems', 'part=contentDetails&maxResults=50&playlistId=' + PLAYLIST +
                           (token ? '&pageToken=' + token : ''))
        .then(function (j) {
          (j.items || []).forEach(function (it) { ids.push(it.contentDetails.videoId); });
          if (j.nextPageToken) return page(j.nextPageToken);

          console.log('[player] playlist ' + PLAYLIST + ': ' + ids.length + ' videos');
          var fresh = keep(ids);
          if (fresh.length < ids.length) {
            console.log('[player] ' + (ids.length - fresh.length) + ' already blocklisted, not re-checking');
          }
          if (!fresh.length) return fallback('every playlist video is blocklisted');

          return verify(fresh).then(function (playable) {
            console.log('[player] ' + playable.length + ' of ' + ids.length + ' confirmed embeddable');
            if (!playable.length) return fallback('API confirmed no embeddable videos');
            IDS = playable;
            finish();
          });
        })
        .catch(function (e) { fallback('Data API failed (' + (e && e.message || e) + ')'); });
    })('');
  }

  function clock() {
    var d = new Date(), h = d.getHours();
    el.h.textContent = (h % 12) || 12;
    el.m.textContent = String(d.getMinutes()).padStart(2, '0');
    el.ap.textContent = h < 12 ? 'am' : 'pm';
  }

  // Decorative, exactly like saloon.wtf's: a random walk that drifts toward ~36.
  // Real presence would need a backend — see the note in chat.
  function presence() {
    var n = 30;
    (function step() {
      setTimeout(function () {
        var up = Math.random() < (n < 36 ? .58 : .42) ? 1 : -1;
        n = Math.max(14, Math.min(58, n + up * (1 + Math.floor(Math.random() * 3))));
        el.online.textContent = n;
        step();
      }, 2500 + Math.random() * 3500);
    })();
  }

  function setPlaying(on) {
    playing = on;
    el.bar.classList.toggle('is-playing', on);
    el.icon.className = on ? 'ph-fill ph-pause' : 'ph-fill ph-play';
    el.play.setAttribute('aria-label', on ? 'Pause' : 'Play');
    kmh.want = on ? CRUISE : 0;      // the bus pulls away / rolls to a stop with the music
  }

  // ---- conductor's dashboard ----
  // The speedometer is the one number everything else hangs off: it eases toward a
  // target rather than snapping, and the road markings take their loop time from it,
  // so the tarmac visibly picks up speed as the bus does.
  var CRUISE = 54, kmh = { at: 0, want: 0 };
  var STATUS = ['बस डिपोमै छ', 'बिस्तारै गुड्दै', 'पृथ्वी राजमार्गमा'];

  function dash() {
    var d = kmh.want - kmh.at;
    kmh.at = Math.abs(d) < 0.4 ? kmh.want : kmh.at + d * 0.05;
    var v = Math.round(kmh.at);
    if (el.kmh) el.kmh.textContent = v;
    if (el.status) el.status.textContent = STATUS[v < 1 ? 0 : v < 32 ? 1 : 2];
    // The 3D stage reads this every frame to scroll the highway and spin the
    // wheels, so the scene rolls to a stop with the speedometer rather than
    // freezing. Publishing a number beats reaching into this closure.
    window.__kmh = kmh.at;
  }

  // Two detuned saws through a lowpass — a passable air horn, and no audio file to
  // ship. Built on click, which is also the gesture browsers need to allow audio.
  var actx = null;
  function horn() {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      var t = actx.currentTime, g = actx.createGain(), lp = actx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1700;
      lp.connect(actx.destination);
      g.connect(lp);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.15, t + 0.04);
      g.gain.setValueAtTime(0.15, t + 0.42);
      g.gain.linearRampToValueAtTime(0, t + 0.6);
      [370, 466].forEach(function (f) {
        var o = actx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.connect(g);
        o.start(t);
        o.stop(t + 0.62);
      });
    } catch (e) {}
  }

  function tick() {
    if (!yt || !yt.getDuration) return;
    var d = yt.getDuration() || 0, c = yt.getCurrentTime() || 0;
    var pct = d ? (c / d) * 100 : 0;
    el.fill.style.width = pct + '%';
    el.seek.setAttribute('aria-valuenow', Math.round(pct));
    el.time.textContent = fmt(c) + ' / ' + fmt(d);

    // It has to keep playing. If the clock hasn't moved for 15s once someone has
    // interacted — dead stream, silent stall, a track that never starts — give up
    // on it and move to the next rather than sitting there forever. This covers the
    // first song failing to start, not just one dying mid-way.
    if (muted || !kicked) { stalled = 0; return; }
    if (c > lastT + 0.01) { lastT = c; stalled = 0; }
    else if (++stalled > 60) {
      stalled = 0;
      console.warn('[player] stalled on', IDS[idx], '- moving on');
      go(idx + 1);
    }
  }

  (function ready() {
    var bar = document.querySelector('.np-bar');
    if (!bar || !document.getElementById('np-yt')) return setTimeout(ready, 50);

    var q = function (s) { return bar.querySelector(s); }, d = function (s) { return document.querySelector(s); };
    el = { bar: bar, cover: q('.np-disc img'), title: q('.np-title'), artist: q('.np-artist'),
           seek: q('.np-seek'), fill: q('.np-fill'), knob: q('.np-knob'), time: q('.np-time'),
           play: q('.np-play'), icon: q('.np-play i'),
           prev: q('.np-prev'), next: q('.np-next'),
           h: d('.np-h'), m: d('.np-m'), ap: d('.np-ap'), online: d('.np-online'),
           kmh: d('.dash-kmh'), status: d('.dash-status'), horn: d('.dash-horn') };

    clock();
    setInterval(clock, 1000);
    presence();
    dash();
    setInterval(dash, 90);
    if (el.horn) el.horn.onclick = function () {
      horn();
      el.horn.classList.add('is-blaring');
      setTimeout(function () { el.horn.classList.remove('is-blaring'); }, 620);
    };

    // YouTube embeds need a real http(s) origin. Opened straight off disk the
    // player gets no referrer, every video fails with error 153, and the bar just
    // races through the playlist. Nothing to fix in code — the page has to be
    // served. `cd` to this folder and run: python3 -m http.server 8000
    if (location.protocol === 'file:') {
      el.title.textContent = 'Serve this page over http://';
      el.artist.textContent = 'YouTube will not play from file://';
      el.time.textContent = 'python3 -m http.server 8000';
      return;
    }

    // Pause exists because a page that plays audio with no way to silence it is
    // hostile (and fails WCAG 1.4.2). Skip forward/back just walks the shuffled
    // order — still nobody picks a specific song.
    el.play.onclick = function () {
      if (!yt) return;
      if (playing) { muted = true; yt.pauseVideo(); }
      else { muted = false; kicked = true; yt.playVideo(); }
    };

    // loadVideoById autoplays, so a skip counts as the ignition gesture too.
    function skip(n) {
      return function () {
        if (!yt) return;
        muted = false;
        kicked = true;
        go(idx + n);
      };
    }
    el.prev.onclick = skip(-1);
    el.next.onclick = skip(1);

    // Browsers refuse to start audio without a gesture, so the first touch anywhere
    // on the page is the ignition. Once it's running these come off.
    function kick() {
      if (!yt || muted) return;
      kicked = true;
      yt.playVideo();
    }
    document.addEventListener('pointerdown', kick);
    document.addEventListener('keydown', kick);
    window.__npUnkick = function () {
      document.removeEventListener('pointerdown', kick);
      document.removeEventListener('keydown', kick);
    };

    setInterval(tick, 250);

    // Debug hook: run npState() in the console to see what the radio thinks.
    window.npState = function () {
      return { kicked: kicked, muted: muted, playing: playing, everPlayed: everPlayed,
               stalled: stalled, lastT: lastT, idx: idx, tracks: IDS.length,
               now: yt && yt.getCurrentTime && yt.getCurrentTime() };
    };

    // The player needs the track list before it can be built, and the IFrame API
    // arrives on its own schedule, so wait for both.
    var apiUp = false, listUp = false;
    function boot() {
      if (!apiUp || !listUp || yt) return;
      // Nothing survived the filters. Building a player on an empty list would
      // load videoId `undefined` and error-loop, so say so and stop instead.
      if (!IDS.length) {
        console.error('[player] no playable tracks. If this looks wrong, clear the blocklist: ' +
                      "localStorage.removeItem('" + KEY + "')");
        el.title.textContent = 'No playable tracks';
        el.artist.textContent = 'Every song in the list is blocked or unembeddable';
        return;
      }
      shuffle(IDS);
      paint();
      yt = new YT.Player('np-yt', {
        videoId: IDS[idx],
        playerVars: { playsinline: 1, controls: 0, disablekb: 1, origin: location.origin },
        events: {
          onStateChange: function (e) {
            if (e.data === YT.PlayerState.PLAYING) {
              misses = 0; everPlayed = true;
              if (window.__npUnkick) { window.__npUnkick(); window.__npUnkick = null; }
            }
            if (e.data === YT.PlayerState.ENDED) {
              // Only advance if the track actually played. A stream that dies can
              // report ENDED without ever starting, which would cascade the whole
              // playlist in a couple of seconds. The watchdog in tick() covers that.
              if (!everPlayed) { setPlaying(false); return; }
              return go(idx + 1);
            }
            // Paused by something other than the visitor (tab throttling, YouTube
            // hiccup)? It's a radio — start it again.
            if (e.data === YT.PlayerState.PAUSED && !muted) { yt.playVideo(); return; }
            setPlaying(e.data === YT.PlayerState.PLAYING || e.data === YT.PlayerState.BUFFERING);
          },
          // A track that won't load would otherwise stall the bar. Skip it — but
          // stop after a full lap so a systemic failure can't spin forever.
          onError: function (e) {
            var id = IDS[idx], perm = (e.data === 100 || e.data === 101 || e.data === 150);
            if (perm) blocklist(id);
            console.warn('[player] skipped', id, 'YouTube error', e.data,
                         perm ? '(dropped for good)' : '(page/player problem, keeping it)');
            if (++misses < IDS.length) go(idx + 1); else setPlaying(false);
          }
        }
      });
    }

    loadList(function () { listUp = true; boot(); });
    window.onYouTubeIframeAPIReady = function () { apiUp = true; boot(); };
    var s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  })();
})();
