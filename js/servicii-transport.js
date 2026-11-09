/* Cargo Vest (servicii-transport): meniul de pe telefon, calculatorul de tarif live,
   urmărirea demonstrativă după cod AWB (CV-1234) și rezumatul pentru rezervare.
   Tarife, distanțe și trasee demonstrative. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // ---------- meniu pe telefon ----------
  var btn = $('[data-menu]');
  var nav = document.getElementById('meniu');
  if (btn && nav) {
    var setOpen = function (open) {
      nav.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Închide meniul' : 'Deschide meniul');
    };
    btn.addEventListener('click', function () { setOpen(!nav.classList.contains('open')); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
  }

  // ---------- orașe (coordonate aproximative) ----------
  var CITIES = [
    ['bucuresti', 'București', 44.43, 26.10, 'RO'], ['cluj', 'Cluj-Napoca', 46.77, 23.59, 'RO'],
    ['timisoara', 'Timișoara', 45.75, 21.23, 'RO'], ['iasi', 'Iași', 47.16, 27.59, 'RO'],
    ['constanta', 'Constanța', 44.18, 28.63, 'RO'], ['brasov', 'Brașov', 45.66, 25.61, 'RO'],
    ['oradea', 'Oradea', 47.07, 21.93, 'RO'], ['arad', 'Arad', 46.18, 21.31, 'RO'],
    ['sibiu', 'Sibiu', 45.79, 24.15, 'RO'], ['craiova', 'Craiova', 44.32, 23.80, 'RO'],
    ['bacau', 'Bacău', 46.57, 26.91, 'RO'],
    ['viena', 'Viena', 48.21, 16.37, 'AT'], ['munchen', 'München', 48.14, 11.58, 'DE'],
    ['stuttgart', 'Stuttgart', 48.78, 9.18, 'DE'], ['milano', 'Milano', 45.46, 9.19, 'IT']
  ];
  var byId = {}; CITIES.forEach(function (c) { byId[c[0]] = c; });
  function km(a, b) {
    var R = 6371, r = Math.PI / 180;
    var dLat = (b[2] - a[2]) * r, dLon = (b[3] - a[3]) * r;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a[2] * r) * Math.cos(b[2] * r) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 1.22); // factor rutier
  }
  var fmt = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };

  // ---------- tarif ----------
  var Q = {
    paleti: { lbl: 'Număr de paleți', min: 1, max: 33, step: 1, def: 6, unit: function (v) { return v + ' pal.'; } },
    colete: { lbl: 'Greutate totală', min: 5, max: 2000, step: 5, def: 120, unit: function (v) { return fmt(v) + ' kg'; } },
    agabaritic: { lbl: 'Greutate utilaj', min: 1, max: 40, step: 1, def: 12, unit: function (v) { return v + ' t'; } }
  };
  function tariff(o) {
    var d = km(byId[o.de], byId[o.la]);
    var p, veh, load, groupage = false;
    if (o.marfa === 'paleti') {
      var full = d * 1.2 + 150;
      p = Math.min(Math.max(75, d * 0.055 * Math.pow(o.q, 0.85) + 8 * o.q), full);
      groupage = o.q < 15;
      veh = o.q <= 8 ? 'Dubă 3,5 t · 8 paleți' : o.q <= 18 ? 'Camion 12 t · 18 paleți' : 'Tir 40 t · 33 paleți';
      load = o.q / 33;
    } else if (o.marfa === 'colete') {
      p = Math.max(25, 15 + d * 0.02 + o.q * d * 0.00012);
      groupage = true;
      veh = 'Dubă de grupaj';
      load = Math.min(1, o.q / 24000 * 6);
    } else {
      p = d * (1.6 + 0.04 * o.q) + 350;
      veh = o.q > 24 ? 'Trailer agabaritic + escortă' : 'Trailer cu platformă joasă';
      load = Math.min(1, o.q / 40);
    }
    if (o.regim === 'express') p *= 1.35;
    if (o.regim === 'frigorific') { p *= 1.2; veh += ' · agregat frigorific'; }
    p = Math.round(p / 5) * 5;
    // timp: condus (9 h pe zi pentru un șofer, 18 h pentru echipaj dublu la express) + încărcare + consolidare grupaj
    var drive = d / (o.marfa === 'agabaritic' ? 50 : 65);
    var perDay = o.regim === 'express' ? 18 : 9;
    var hours = drive + 2 + (groupage && o.regim !== 'express' ? 18 : 0);
    var days = Math.ceil(drive / perDay) + (groupage && o.regim !== 'express' ? 1 : 0);
    var timp = hours <= 24 && days <= 1 ? '≈ ' + Math.ceil(hours) + ' ore' : days + ' zile';
    return { km: d, pret: p, veh: veh, load: load, timp: timp, days: Math.max(1, days) };
  }

  var calc = document.getElementById('calc');
  var selDe = document.getElementById('c-de'), selLa = document.getElementById('c-la');
  var qIn = document.getElementById('c-q');
  var lastMarfa = 'paleti', last = null;
  function fill(sel, val) {
    var g1 = document.createElement('optgroup'); g1.label = 'România';
    var g2 = document.createElement('optgroup'); g2.label = 'Europa de Vest';
    CITIES.forEach(function (c) {
      var o = document.createElement('option'); o.value = c[0]; o.textContent = c[1] + (c[4] !== 'RO' ? ' (' + c[4] + ')' : '');
      (c[4] === 'RO' ? g1 : g2).appendChild(o);
    });
    sel.appendChild(g1); sel.appendChild(g2); sel.value = val;
  }
  function read() {
    return {
      de: selDe.value, la: selLa.value, q: +qIn.value,
      marfa: ($('input[name="marfa"]:checked', calc) || {}).value || 'paleti',
      regim: ($('input[name="regim"]:checked', calc) || {}).value || 'standard'
    };
  }
  function render() {
    var o = read();
    if (o.marfa !== lastMarfa) {
      var c = Q[o.marfa]; lastMarfa = o.marfa;
      qIn.min = c.min; qIn.max = c.max; qIn.step = c.step; qIn.value = c.def; o.q = c.def;
      document.getElementById('c-q-lbl').textContent = c.lbl;
    }
    document.getElementById('c-q-out').textContent = Q[o.marfa].unit(o.q);
    var same = o.de === o.la;
    document.getElementById('r-warn').hidden = !same;
    var nameDe = byId[o.de][1], nameLa = byId[o.la][1];
    if (same) {
      last = null;
      ['r-pret', 'r-km', 'r-timp', 'r-veh'].forEach(function (id) { document.getElementById(id).textContent = '—'; });
      document.getElementById('r-ruta').textContent = nameDe + ' → ' + nameLa;
      summary(); return;
    }
    var r = last = tariff(o);
    r.ruta = nameDe + ' → ' + nameLa; r.q = Q[o.marfa].unit(o.q); r.marfa = o.marfa; r.regim = o.regim;
    document.getElementById('r-pret').textContent = fmt(r.pret);
    document.getElementById('r-ruta').textContent = r.ruta + ' · ' + r.q + ' · ' + o.regim;
    document.getElementById('r-km').textContent = fmt(r.km) + ' km';
    document.getElementById('r-timp').textContent = r.timp;
    document.getElementById('r-veh').textContent = r.veh;
    document.getElementById('r-bar').style.transform = 'scaleX(' + Math.max(0.03, r.load).toFixed(3) + ')';
    document.getElementById('r-load').textContent = o.marfa === 'paleti' ? Math.round(r.load * 100) + '% din capacitatea unui tir' : o.marfa === 'colete' ? 'spațiu partajat (grupaj)' : 'transport dedicat';
    summary();
  }
  function summary() {
    var MARFA = { paleti: 'paleți', colete: 'colete', agabaritic: 'agabaritic' };
    document.getElementById('b-ruta').textContent = last ? last.ruta + ' · ' + fmt(last.km) + ' km' : '—';
    document.getElementById('b-marfa').textContent = last ? MARFA[last.marfa] + ', ' + last.q + ', ' + last.regim : '—';
    document.getElementById('b-pret').textContent = last ? fmt(last.pret) + ' EUR + TVA · ' + last.timp : '—';
  }
  if (calc) {
    fill(selDe, 'timisoara'); fill(selLa, 'viena');
    calc.addEventListener('input', render);
    calc.addEventListener('change', render);
    calc.addEventListener('submit', function (e) { e.preventDefault(); });
    $('[data-swap]').addEventListener('click', function () { var t = selDe.value; selDe.value = selLa.value; selLa.value = t; render(); });
    render();
  }

  // ---------- rezervare: data minimă mâine ----------
  var iso = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  var bData = document.getElementById('b-data');
  if (bData) { var t = new Date(); t.setDate(t.getDate() + 1); bData.min = iso(t); }

  // ---------- urmărire demonstrativă ----------
  var ROUTES = [
    ['Timișoara', 'Viena', 'Nădlac II – Nagylak (RO/HU)'],
    ['Cluj-Napoca', 'München', 'Borș – Ártánd (RO/HU)'],
    ['Arad', 'Stuttgart', 'Nădlac II – Nagylak (RO/HU)'],
    ['Oradea', 'Milano', 'Borș – Ártánd (RO/HU)'],
    ['București', 'Cluj-Napoca', 'Punct de control Sibiu (intern)'],
    ['Brașov', 'Viena', 'Nădlac II – Nagylak (RO/HU)']
  ];
  var LUNI = ['ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.', 'iul.', 'aug.', 'sept.', 'oct.', 'nov.', 'dec.'];
  function stamp(d) { return d.getDate() + ' ' + LUNI[d.getMonth()] + ' · ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  var panel = document.getElementById('tl');
  function track(raw) {
    var code = String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
    var m = code.match(/^CV-?(\d{4})$/);
    panel.textContent = '';
    if (!m) {
      panel.appendChild(el('p', 'empty', '> Cod invalid: „' + (code || '—') + '”. Formatul este CV-1234 (CV, cratimă și 4 cifre).'));
      return false;
    }
    var n = +m[1];
    code = 'CV-' + m[1];
    var route = ROUTES[n % ROUTES.length];
    var stage = n % 4; // 0 preluat, 1 în tranzit, 2 frontieră, 3 livrat
    var intern = /intern/.test(route[2]);
    var now = new Date();
    var steps = [
      ['Preluat', 'Încărcat la rampă, depozit ' + route[0], 'ok'],
      ['În tranzit', 'Pe autostradă, camion CV-' + (10 + n % 40) + ' · șofer confirmat', ''],
      [intern ? 'Punct de control' : 'Vamă / graniță', route[2] + (intern ? '' : ' · documente CMR verificate'), ''],
      ['Livrat', 'Predat destinatarului în ' + route[1] + ' · semnătură primită', '']
    ];
    // ore: fiecare etapă la ~6–9 h după precedenta, ultima atinsă e „acum” minus câteva ore
    var gaps = [0, 3 + n % 3, 6 + n % 4, 7 + n % 5];
    var t0 = new Date(now.getTime() - (gaps.slice(1, stage + 1).reduce(function (a, b) { return a + b; }, 0) + 1 + n % 2) * 3600e3);
    var head = el('div', 'tl-top');
    var left = el('div'); left.appendChild(el('b', '', code)); left.appendChild(el('span', '', route[0] + ' → ' + route[1]));
    head.appendChild(left);
    head.appendChild(el('span', 'state' + (stage === 3 ? ' done' : ''), stage === 3 ? 'Livrat' : steps[stage][0]));
    panel.appendChild(head);
    var ol = el('ol', 'tl');
    var t = t0.getTime();
    steps.forEach(function (s, i) {
      if (i) t += gaps[i] * 3600e3;
      var li = el('li', i < stage ? 'ok' : i === stage ? (stage === 3 ? 'ok' : 'now') : 'wait');
      var when = i <= stage ? stamp(new Date(t)) : 'estimat ' + stamp(new Date(t + 1800e3));
      li.appendChild(el('time', '', when));
      var d = el('div'); d.appendChild(el('b', '', s[0])); d.appendChild(el('small', '', s[1]));
      li.appendChild(d); ol.appendChild(li);
    });
    panel.appendChild(ol);
    return true;
  }
  $$('[data-track]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = f.elements.awb.value;
      $$('[data-track] input').forEach(function (i) { i.value = v.toUpperCase(); });
      track(v);
      var sec = document.getElementById('urmarire');
      if (sec && !sec.contains(f)) sec.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  });
  $$('[data-try]').forEach(function (b) {
    b.addEventListener('click', function () {
      var v = b.getAttribute('data-try');
      $$('[data-track] input').forEach(function (i) { i.value = v; });
      track(v);
    });
  });
  // exemplu afișat la încărcare
  if (panel) track('CV-1234');
})();
