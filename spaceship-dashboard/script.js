/* ============================================================
   NEXUS-9 — Komuta Terminali
   Saf HTML / CSS / JS ile uzay gemisi kokpiti admin paneli
   ============================================================ */

(() => {
  'use strict';

  // Shared 3D state. warpBoost is spiked by the warp button and decays every
  // frame, letting the starfield and hologram briefly accelerate together.
  let warpBoost = 0;
  function accentRGB() {
    return (getComputedStyle(document.documentElement)
      .getPropertyValue('--accent-rgb').trim()) || '93,241,255';
  }

  /* ---------------- BOOT SEQUENCE ---------------- */
  const bootLines = [
    '> NEXUS-9 ÇEKİRDEK BIOS v4.2.1 başlatılıyor...',
    '> Kuantum veri veriyolu doğrulanıyor... TAMAM',
    '> Kalkan jeneratörleri kalibre ediliyor... TAMAM',
    '> Yaşam destek sensör ağı taranıyor... TAMAM',
    '> Navigasyon çekirdeği eşitleniyor... TAMAM',
    '> Uzak yıldız haritası önbelleğe alınıyor...',
    '> Mürettebat kimlik veritabanı yükleniyor...',
    '> Komuta arayüzü oluşturuluyor...',
  ];

  function runBootSequence() {
    const log = document.getElementById('boot-log');
    const bar = document.getElementById('boot-bar');
    const pct = document.getElementById('boot-percent');
    const screen = document.getElementById('boot-screen');
    const app = document.getElementById('app');

    let i = 0;
    let progress = 0;

    const lineTimer = setInterval(() => {
      if (i < bootLines.length) {
        const div = document.createElement('div');
        div.textContent = bootLines[i];
        div.style.animationDelay = '0s';
        log.appendChild(div);
        log.scrollTop = log.scrollHeight;
        i++;
      } else {
        clearInterval(lineTimer);
      }
    }, 220);

    const progTimer = setInterval(() => {
      progress += Math.random() * 9 + 4;
      if (progress >= 100) {
        progress = 100;
        clearInterval(progTimer);
        setTimeout(() => {
          screen.classList.add('hidden');
          app.classList.add('ready');
          initDashboard();
        }, 350);
      }
      bar.style.width = progress + '%';
      pct.textContent = Math.floor(progress) + '%';
    }, 180);
  }

  /* ---------------- 3D WARP STARFIELD ---------------- */
  function initStarfield() {
    const canvas = document.getElementById('starfield');
    const ctx = canvas.getContext('2d');
    let stars = [];
    let w, h;
    let enabled = true;

    // Each star lives in normalized 3D space: x,y in [-1,1], z depth in (0,1].
    // z shrinks every frame so the star flies toward the camera; projecting
    // x/z and y/z produces true perspective — and the gap between the previous
    // and current projection is drawn as a warp streak.
    function newStar(reset) {
      return {
        x: Math.random() * 2 - 1,
        y: Math.random() * 2 - 1,
        z: reset ? 1 : Math.random() * 0.9 + 0.1,
        pz: 1,
      };
    }

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      const count = Math.floor((w * h) / 6500);
      stars = Array.from({ length: count }, () => newStar(false));
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      if (!enabled) { requestAnimationFrame(draw); return; }
      const cx = w / 2, cy = h / 2;
      const k = 150 * (w / 1600);
      const speed = 0.0045 + warpBoost;

      for (const s of stars) {
        s.pz = s.z;
        s.z -= speed;
        if (s.z < 0.04) { Object.assign(s, newStar(true)); continue; }

        const sx = cx + (s.x / s.z) * k;
        const sy = cy + (s.y / s.z) * k;
        const px = cx + (s.x / s.pz) * k;
        const py = cy + (s.y / s.pz) * k;

        if (sx < -20 || sx > w + 20 || sy < -20 || sy > h + 20) continue;

        const depth = 1 - s.z;
        const alpha = Math.min(1, depth * 1.3);
        const size = Math.max(0.4, depth * 2.2);

        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(sx, sy);
        ctx.strokeStyle = warpBoost > 0.01
          ? `rgba(${accentRGB()}, ${alpha})`
          : `rgba(175, 220, 255, ${alpha})`;
        ctx.lineWidth = size;
        ctx.stroke();
      }

      warpBoost *= 0.94;
      if (warpBoost < 0.001) warpBoost = 0;
      requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize);
    resize();
    draw();

    document.getElementById('toggle-stars')?.addEventListener('change', (e) => {
      enabled = e.target.checked;
    });
  }

  /* ---------------- CLOCK / STARDATE ---------------- */
  function initClock() {
    function pad(n) { return String(n).padStart(2, '0'); }
    function tick() {
      const now = new Date();
      document.getElementById('clock-time').textContent =
        `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      const stardate = (now.getFullYear() + (now.getMonth() * 30 + now.getDate()) / 365).toFixed(2);
      document.getElementById('clock-date').textContent = `YILDIZ TARİHİ ${stardate}`;
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ---------------- NAVIGATION ---------------- */
  function initNav() {
    const items = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');
    const title = document.getElementById('view-title');
    const crumb = document.getElementById('view-crumb');

    const titles = {
      overview: 'GENEL BAKIŞ',
      crew: 'MÜRETTEBAT',
      systems: 'SİSTEMLER',
      navigation: 'NAVİGASYON',
      logs: 'KAYITLAR',
      settings: 'AYARLAR',
    };

    items.forEach((btn) => {
      btn.addEventListener('click', () => {
        items.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.dataset.view;
        views.forEach((v) => v.classList.toggle('active', v.id === `view-${target}`));
        title.textContent = titles[target];
        crumb.textContent = titles[target].charAt(0) + titles[target].slice(1).toLowerCase();
      });
    });
  }

  /* ---------------- ANIMATED COUNTERS ---------------- */
  function animateCounters() {
    document.querySelectorAll('[data-count]').forEach((el) => {
      const target = parseInt(el.dataset.count, 10);
      const suffix = el.dataset.suffix || '';
      let current = 0;
      const step = Math.max(1, target / 40);
      const timer = setInterval(() => {
        current += step;
        if (current >= target) {
          current = target;
          clearInterval(timer);
        }
        el.textContent = Math.floor(current) + suffix;
      }, 25);
    });
  }

  /* ---------------- CORE POWER RING ---------------- */
  function initCoreRing() {
    const ring = document.getElementById('core-ring-fg');
    const label = document.getElementById('core-power-label');
    const value = 92;
    const circumference = 264;
    requestAnimationFrame(() => {
      ring.style.strokeDashoffset = circumference - (circumference * value) / 100;
    });
    label.textContent = value + '%';
  }

  /* ---------------- HUD LIVE VALUES ---------------- */
  function initHudDrift() {
    const shieldEl = document.getElementById('hud-shield');
    const hullEl = document.getElementById('hud-hull');
    const oxyEl = document.getElementById('hud-oxygen');
    let shield = 98, hull = 100, oxy = 87;

    setInterval(() => {
      shield = clamp(shield + rand(-1, 1), 90, 100);
      hull = clamp(hull + rand(-0.3, 0.1), 96, 100);
      oxy = clamp(oxy + rand(-1.2, 1), 78, 96);
      shieldEl.textContent = Math.round(shield) + '%';
      hullEl.textContent = Math.round(hull) + '%';
      oxyEl.textContent = Math.round(oxy) + '%';
    }, 2200);
  }

  function rand(min, max) { return Math.random() * (max - min) + min; }
  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

  // Canvases inside inactive tabs report 0x0 size until their view becomes
  // visible, so plain window-resize listeners never catch the real size.
  // A ResizeObserver fires as soon as the layout actually changes.
  function watchResize(canvas, onResize) {
    const ro = new ResizeObserver(() => onResize());
    ro.observe(canvas);
  }

  /* ---------------- RADAR CANVAS ---------------- */
  function initRadar() {
    const canvas = document.getElementById('radar-canvas');
    const ctx = canvas.getContext('2d');
    let angle = 0;

    const blips = Array.from({ length: 9 }, () => ({
      a: Math.random() * Math.PI * 2,
      r: Math.random() * 0.85 + 0.1,
      hit: 0,
    }));

    function resize() {
      canvas.width = canvas.clientWidth * devicePixelRatio;
      canvas.height = canvas.clientHeight * devicePixelRatio;
    }

    function draw() {
      const w = canvas.width, h = canvas.height;
      if (w <= 20 || h <= 20) { requestAnimationFrame(draw); return; }
      const cx = w / 2, cy = h / 2;
      const radius = Math.min(w, h) / 2 - 10;
      ctx.clearRect(0, 0, w, h);

      // rings
      ctx.strokeStyle = 'rgba(93,241,255,0.18)';
      ctx.lineWidth = 1;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, (radius / 3) * i, 0, Math.PI * 2);
        ctx.stroke();
      }
      // crosshair
      ctx.beginPath();
      ctx.moveTo(cx - radius, cy); ctx.lineTo(cx + radius, cy);
      ctx.moveTo(cx, cy - radius); ctx.lineTo(cx, cy + radius);
      ctx.stroke();

      // sweep
      angle += 0.02;
      const grad = ctx.createConicGradient
        ? ctx.createConicGradient(angle - Math.PI / 2, cx, cy)
        : null;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, angle - 0.5, angle);
      ctx.closePath();
      ctx.fillStyle = 'rgba(93,241,255,0.15)';
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
      ctx.strokeStyle = '#5df1ff';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#5df1ff';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // blips
      blips.forEach((b) => {
        const bx = cx + Math.cos(b.a) * b.r * radius;
        const by = cy + Math.sin(b.a) * b.r * radius;
        let diff = Math.abs(((angle - b.a) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2));
        if (diff < 0.5) b.hit = 1;
        b.hit *= 0.94;
        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 93, 224, ${0.4 + b.hit * 0.6})`;
        ctx.arc(bx, by, 2.5 + b.hit * 2, 0, Math.PI * 2);
        ctx.fill();
      });

      requestAnimationFrame(draw);
    }

    resize();
    watchResize(canvas, resize);
    draw();
  }

  /* ---------------- TELEMETRY LINE CHART ---------------- */
  function initTelemetry() {
    const canvas = document.getElementById('telemetry-canvas');
    const ctx = canvas.getContext('2d');
    const series = {
      power: Array.from({ length: 40 }, () => 70 + Math.random() * 20),
      shield: Array.from({ length: 40 }, () => 85 + Math.random() * 12),
      thermal: Array.from({ length: 40 }, () => 40 + Math.random() * 25),
    };
    const colors = { power: '#5df1ff', shield: '#ff5de0', thermal: '#ffd25d' };

    function resize() {
      canvas.width = canvas.clientWidth * devicePixelRatio;
      canvas.height = canvas.clientHeight * devicePixelRatio;
    }

    function pushVal(arr, min, max, drift) {
      const last = arr[arr.length - 1];
      let next = clamp(last + rand(-drift, drift), min, max);
      arr.push(next);
      arr.shift();
    }

    function drawLine(arr, color, w, h) {
      ctx.beginPath();
      arr.forEach((v, i) => {
        const x = (i / (arr.length - 1)) * w;
        const y = h - (v / 100) * h;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 * devicePixelRatio;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    function frame() {
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // grid
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        const y = (h / 4) * i;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      drawLine(series.power, colors.power, w, h);
      drawLine(series.shield, colors.shield, w, h);
      drawLine(series.thermal, colors.thermal, w, h);

      requestAnimationFrame(frame);
    }

    resize();
    watchResize(canvas, resize);
    frame();

    setInterval(() => {
      pushVal(series.power, 55, 100, 6);
      pushVal(series.shield, 80, 100, 4);
      pushVal(series.thermal, 25, 75, 8);
    }, 900);
  }

  /* ---------------- ALLOCATION DONUT CHART ---------------- */
  function initAllocation() {
    const canvas = document.getElementById('alloc-canvas');
    const ctx = canvas.getContext('2d');
    const data = [
      { label: 'İtki', value: 34, color: '#5df1ff' },
      { label: 'Kalkanlar', value: 26, color: '#ff5de0' },
      { label: 'Yaşam Destek', value: 22, color: '#ffd25d' },
      { label: 'Sensörler', value: 18, color: '#7dff8a' },
    ];

    function resize() {
      canvas.width = canvas.clientWidth * devicePixelRatio;
      canvas.height = canvas.clientHeight * devicePixelRatio;
      draw();
    }

    let rot = 0;
    function draw() {
      const w = canvas.width, h = canvas.height;
      if (w <= 20 || h <= 20) return;
      const cx = w / 2, cy = h / 2;
      const radius = Math.min(w, h) / 2 - 10;
      ctx.clearRect(0, 0, w, h);
      let start = -Math.PI / 2 + rot;
      const total = data.reduce((a, d) => a + d.value, 0);
      data.forEach((d) => {
        const slice = (d.value / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, start, start + slice);
        ctx.closePath();
        ctx.fillStyle = d.color;
        ctx.globalAlpha = 0.85;
        ctx.fill();
        start += slice;
      });
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = '#0b1220';
      ctx.fill();

      ctx.fillStyle = '#eaf6ff';
      ctx.textAlign = 'center';
      ctx.font = `${14 * devicePixelRatio}px Orbitron`;
      ctx.fillText('KAYNAK', cx, cy - 4 * devicePixelRatio);
      ctx.font = `${10 * devicePixelRatio}px 'Share Tech Mono'`;
      ctx.fillStyle = '#5c7185';
      ctx.fillText('DAĞILIMI', cx, cy + 12 * devicePixelRatio);
    }

    watchResize(canvas, resize);
    resize();
    setInterval(() => { rot += 0.003; draw(); }, 50);
  }

  /* ---------------- ROUTE CANVAS ---------------- */
  function initRoute() {
    const canvas = document.getElementById('route-canvas');
    const ctx = canvas.getContext('2d');
    const points = Array.from({ length: 6 }, (_, i) => ({
      x: 0.1 + i * 0.16 + Math.random() * 0.05,
      y: 0.3 + Math.sin(i) * 0.2 + Math.random() * 0.1,
    }));
    let t = 0;

    function resize() {
      canvas.width = canvas.clientWidth * devicePixelRatio;
      canvas.height = canvas.clientHeight * devicePixelRatio;
    }

    function draw() {
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(93,241,255,0.15)';
      for (let i = 0; i < 10; i++) {
        ctx.beginPath();
        ctx.moveTo((w / 10) * i, 0);
        ctx.lineTo((w / 10) * i, h);
        ctx.stroke();
      }

      ctx.beginPath();
      points.forEach((p, i) => {
        const x = p.x * w, y = p.y * h;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#5df1ff';
      ctx.lineWidth = 2 * devicePixelRatio;
      ctx.setLineDash([6 * devicePixelRatio, 6 * devicePixelRatio]);
      ctx.stroke();
      ctx.setLineDash([]);

      points.forEach((p, i) => {
        const x = p.x * w, y = p.y * h;
        ctx.beginPath();
        ctx.arc(x, y, 4 * devicePixelRatio, 0, Math.PI * 2);
        ctx.fillStyle = i === points.length - 1 ? '#ff5de0' : '#5df1ff';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // moving ship marker
      t += 0.004;
      const idx = t % 1 * (points.length - 1);
      const i0 = Math.floor(idx), i1 = Math.min(points.length - 1, i0 + 1);
      const f = idx - i0;
      const sx = (points[i0].x + (points[i1].x - points[i0].x) * f) * w;
      const sy = (points[i0].y + (points[i1].y - points[i0].y) * f) * h;
      ctx.beginPath();
      ctx.arc(sx, sy, 6 * devicePixelRatio, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd25d';
      ctx.shadowColor = '#ffd25d';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      requestAnimationFrame(draw);
    }

    resize();
    watchResize(canvas, resize);
    draw();

    const routeData = [
      { name: 'Kepler-442 İstasyonu', eta: 'VARDI' },
      { name: 'Andromeda Geçidi', eta: 'VARDI' },
      { name: 'Vega Yakıt İkmali', eta: 'VARDI' },
      { name: 'Orion Kemeri', eta: '02:14:09' },
      { name: 'Nexus Ana Üssü', eta: '14:52:31' },
    ];
    const list = document.getElementById('route-list');
    list.innerHTML = routeData.map(r => `<li><span>${r.name}</span><b>${r.eta}</b></li>`).join('');
  }

  /* ---------------- TERMINAL LOG FEED ---------------- */
  const logMessages = [
    { tag: 'SİSTEM', cls: 'tag', text: 'Kalkan matrisi optimum parametrelerde.' },
    { tag: 'NAVİGASYON', cls: 'tag', text: 'Rota sapması %0.03 — düzeltiliyor.' },
    { tag: 'UYARI', cls: 'tag-warn', text: 'Oksijen seviyesi 3. güvertede dalgalanıyor.' },
    { tag: 'MÜRETTEBAT', cls: 'tag', text: 'Teğmen Alara köprüye giriş yaptı.' },
    { tag: 'SENSÖR', cls: 'tag', text: 'Uzak menzil taraması tamamlandı — anomali yok.' },
    { tag: 'GÜÇ', cls: 'tag', text: 'Çekirdek çıkışı %92 stabil seviyede.' },
    { tag: 'HATA', cls: 'tag-err', text: 'İkincil anten dizisinde sinyal kesintisi.' },
    { tag: 'İLETİŞİM', cls: 'tag', text: 'Nexus Ana Üssü ile bağlantı kuruldu.' },
    { tag: 'BAKIM', cls: 'tag', text: 'Robotik kol #4 rutin denetimden geçti.' },
    { tag: 'NAVİGASYON', cls: 'tag', text: 'Warp penceresi 6 saat sonra açılacak.' },
  ];

  function pad2(n) { return String(n).padStart(2, '0'); }

  function appendLog(container) {
    const now = new Date();
    const msg = logMessages[Math.floor(Math.random() * logMessages.length)];
    const line = document.createElement('div');
    line.className = 'line';
    line.innerHTML = `<span class="ts">[${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}]</span><span class="${msg.cls}">${msg.tag}</span> — ${msg.text}`;
    container.appendChild(line);
    container.scrollTop = container.scrollHeight;
    while (container.children.length > 60) container.removeChild(container.firstChild);
  }

  function initTerminals() {
    const t1 = document.getElementById('terminal');
    const t2 = document.getElementById('terminal-full');
    for (let i = 0; i < 8; i++) { appendLog(t1); appendLog(t2); }
    setInterval(() => { appendLog(t1); appendLog(t2); }, 2400);
  }

  /* ---------------- CREW TABLE ---------------- */
  const crewData = [
    { id: 'NX-001', name: 'Kaptan Elif Voss', role: 'Komutan', rank: 'Kaptan', status: 'online', clearance: 'ALFA' },
    { id: 'NX-014', name: 'Teğmen Alara Kade', role: 'Baş Pilot', rank: 'Teğmen', status: 'online', clearance: 'BETA' },
    { id: 'NX-022', name: 'Dr. Renjiro Osei', role: 'Baş Bilim Subayı', rank: 'Binbaşı', status: 'away', clearance: 'GAMMA' },
    { id: 'NX-035', name: 'Mühendis Talia Krux', role: 'Sistem Mühendisi', rank: 'Uzman', status: 'online', clearance: 'BETA' },
    { id: 'NX-041', name: 'Astrogator Mira Solen', role: 'Navigasyon', rank: 'Teğmen', status: 'offline', clearance: 'GAMMA' },
    { id: 'NX-058', name: 'Güvenlik Şefi Doran Vex', role: 'Güvenlik', rank: 'Yüzbaşı', status: 'online', clearance: 'BETA' },
    { id: 'NX-063', name: 'Dr. Ines Farrow', role: 'Tıp Subayı', rank: 'Binbaşı', status: 'away', clearance: 'GAMMA' },
    { id: 'NX-077', name: 'Teknisyen Bo Larkin', role: 'Bakım Ekibi', rank: 'Er', status: 'online', clearance: 'DELTA' },
    { id: 'NX-089', name: 'İletişim Subayı Nyra Vel', role: 'İletişim', rank: 'Teğmen', status: 'offline', clearance: 'GAMMA' },
    { id: 'NX-093', name: 'Dr. Cassian Ford', role: 'Yaşam Destek', rank: 'Uzman', status: 'online', clearance: 'BETA' },
  ];

  const statusLabel = { online: 'ÇEVRİMİÇİ', away: 'GÖREVDE', offline: 'ÇEVRİMDIŞI' };

  function renderCrew(filter = '') {
    const tbody = document.getElementById('crew-tbody');
    const rows = crewData.filter(c =>
      c.name.toLowerCase().includes(filter.toLowerCase()) ||
      c.role.toLowerCase().includes(filter.toLowerCase()) ||
      c.id.toLowerCase().includes(filter.toLowerCase())
    );
    tbody.innerHTML = rows.map(c => `
      <tr>
        <td class="crew-id">${c.id}</td>
        <td>${c.name}</td>
        <td>${c.role}</td>
        <td>${c.rank}</td>
        <td><span class="status-pill ${c.status}">${statusLabel[c.status]}</span></td>
        <td>${c.clearance}</td>
      </tr>
    `).join('') || `<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:20px;">Eşleşen mürettebat bulunamadı.</td></tr>`;
  }

  function initCrew() {
    renderCrew();
    document.getElementById('crew-search').addEventListener('input', (e) => {
      renderCrew(e.target.value);
    });
  }

  /* ---------------- GAUGES (SYSTEMS VIEW) ---------------- */
  function makeGauge(label, value, color) {
    const circumference = 2 * Math.PI * 34;
    const offset = circumference - (circumference * value) / 100;
    return `
      <div class="gauge">
        <svg viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="7"/>
          <circle cx="40" cy="40" r="34" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"
            stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
            style="filter:drop-shadow(0 0 4px ${color})"/>
        </svg>
        <span class="gauge-val">${value}%</span>
        <span class="gauge-label">${label}</span>
      </div>`;
  }

  function initGauges() {
    document.getElementById('gauges-engine').innerHTML = [
      makeGauge('İtki 1', 88, '#5df1ff'),
      makeGauge('İtki 2', 91, '#5df1ff'),
      makeGauge('Warp Bobini', 76, '#ff5de0'),
      makeGauge('Manevra Jeti', 95, '#7dff8a'),
    ].join('');

    document.getElementById('gauges-life').innerHTML = [
      makeGauge('Oksijen', 87, '#ffd25d'),
      makeGauge('Sıcaklık', 94, '#7dff8a'),
      makeGauge('Nem', 68, '#5df1ff'),
      makeGauge('Filtrasyon', 99, '#7dff8a'),
    ].join('');
  }

  const matrixData = [
    { name: 'Ana Reaktör', status: 'ÇEVRİMİÇİ', cls: 'ok' },
    { name: 'Yardımcı Güç', status: 'ÇEVRİMİÇİ', cls: 'ok' },
    { name: 'Kalkan Jeneratörü', status: 'ÇEVRİMİÇİ', cls: 'ok' },
    { name: 'Silah Sistemleri', status: 'BEKLEMEDE', cls: 'warn' },
    { name: 'Işınlanma Odası', status: 'ÇEVRİMİÇİ', cls: 'ok' },
    { name: 'Robotik Kollar', status: 'ÇEVRİMİÇİ', cls: 'ok' },
    { name: 'İkincil Anten', status: 'ARIZALI', cls: 'err' },
    { name: 'Kriyo Bölmeleri', status: 'ÇEVRİMİÇİ', cls: 'ok' },
    { name: 'Atık Geri Dönüşüm', status: 'BAKIMDA', cls: 'warn' },
    { name: 'Yerçekimi Jeneratörü', status: 'ÇEVRİMİÇİ', cls: 'ok' },
  ];

  function initMatrix() {
    document.getElementById('matrix-grid').innerHTML = matrixData.map(m => `
      <div class="matrix-cell ${m.cls}">
        <span class="name">${m.name}</span>
        <span class="status">${m.status}</span>
      </div>
    `).join('');
  }

  /* ---------------- ALERTS ---------------- */
  const alertsData = [
    { title: 'Oksijen dalgalanması', detail: '3. güverte — izleniyor', time: '2 dk önce' },
    { title: 'İkincil anten arızası', detail: 'Bakım ekibi yönlendirildi', time: '11 dk önce' },
    { title: 'Warp penceresi yaklaşıyor', detail: '6 saat içinde açılacak', time: '40 dk önce' },
  ];

  function initAlerts() {
    document.getElementById('alert-list').innerHTML = alertsData.map(a => `
      <li>⚠️<div><b>${a.title}</b><small>${a.detail} · ${a.time}</small></div></li>
    `).join('');

    const bell = document.getElementById('alert-bell');
    const panel = document.getElementById('alert-panel');
    bell.addEventListener('click', () => panel.classList.toggle('open'));
    document.getElementById('close-alerts').addEventListener('click', () => panel.classList.remove('open'));
    document.addEventListener('click', (e) => {
      if (!panel.contains(e.target) && !bell.contains(e.target)) panel.classList.remove('open');
    });
  }

  /* ---------------- TOASTS ---------------- */
  function toast(message) {
    const wrap = document.getElementById('toast-wrap');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .4s ease';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 400);
    }, 3200);
  }

  /* ---------------- SETTINGS ---------------- */
  function initSettings() {
    document.getElementById('toggle-scanlines').addEventListener('change', (e) => {
      document.body.classList.toggle('no-scanlines', !e.target.checked);
    });

    document.querySelectorAll('.swatch').forEach((btn) => {
      btn.addEventListener('click', () => {
        const themes = {
          cyan: '93,241,255',
          magenta: '255,93,224',
          green: '125,255,138',
          amber: '255,210,93',
        };
        const theme = btn.dataset.theme;
        document.documentElement.style.setProperty('--accent-rgb', themes[theme]);
        document.documentElement.style.setProperty('--accent', `rgb(${themes[theme]})`);
        toast(`Vurgu rengi güncellendi: ${theme.toUpperCase()}`);
      });
    });

    document.getElementById('warp-btn').addEventListener('click', () => {
      const overlay = document.getElementById('flash-overlay');
      overlay.classList.add('flash');
      warpBoost = 0.06;   // spike the 3D warp starfield + spin the hologram
      toast('WARP SÜRÜCÜSÜ ETKİNLEŞTİRİLDİ — Işık hızına geçiliyor');
      setTimeout(() => overlay.classList.remove('flash'), 800);
    });

    document.getElementById('alarm-btn').addEventListener('click', () => {
      toast('GENEL ALARM TATBİKATI başlatıldı — tüm güverteler bilgilendirildi');
    });

    document.getElementById('reboot-btn').addEventListener('click', () => {
      toast('Çekirdek yeniden başlatma dizisi kuyruğa alındı');
    });
  }

  /* ---------------- 3D HELPERS ---------------- */
  // Rotate a point around the Y axis then the X axis.
  function rotateXY(p, ry, rx) {
    const cy = Math.cos(ry), sy = Math.sin(ry);
    const x1 = p.x * cy + p.z * sy;
    const z1 = -p.x * sy + p.z * cy;
    const cx = Math.cos(rx), sx = Math.sin(rx);
    const y1 = p.y * cx - z1 * sx;
    const z2 = p.y * sx + z1 * cx;
    return { x: x1, y: y1, z: z2 };
  }
  // Perspective projection. Front-facing points (negative z) sit closer.
  function project3d(p, w, h, R, focal) {
    const s = focal / (focal + p.z);
    return { x: w / 2 + p.x * R * s, y: h / 2 + p.y * R * s, z: p.z, s };
  }

  /* ---------------- HOLOGRAM NAV SPHERE ---------------- */
  function initHologram() {
    const canvas = document.getElementById('holo-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rotOut = document.getElementById('holo-rot');
    const LAT = 12, LON = 24;
    let ry = 0, t = 0;

    // Fixed surface beacons scattered over the sphere (lat, lon in radians).
    const beacons = Array.from({ length: 7 }, () => ({
      phi: (Math.random() - 0.5) * Math.PI * 0.9,
      th: Math.random() * Math.PI * 2,
    }));

    function resize() {
      canvas.width = canvas.clientWidth * devicePixelRatio;
      canvas.height = canvas.clientHeight * devicePixelRatio;
    }

    // Draw a projected polyline segment-by-segment, fading + thinning the
    // parts of the mesh that face away from the camera for real depth.
    function strokeDepth(pts, rgb) {
      for (let k = 0; k < pts.length - 1; k++) {
        const a = pts[k], b = pts[k + 1];
        const zz = (a.z + b.z) / 2;              // -1 (front) .. 1 (back)
        const front = 1 - (zz + 1) / 2;          // 1 front .. 0 back
        ctx.strokeStyle = `rgba(${rgb}, ${0.1 + front * 0.55})`;
        ctx.lineWidth = (0.5 + front * 1.2) * devicePixelRatio;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    function frame() {
      const w = canvas.width, h = canvas.height;
      if (w <= 20 || h <= 20) { requestAnimationFrame(frame); return; }
      ctx.clearRect(0, 0, w, h);

      const R = Math.min(w, h) * 0.34;
      const focal = 3.2;
      const rgb = accentRGB();
      ry += 0.009 + warpBoost * 0.6;
      t += 0.016;
      const rx = -0.42 + Math.sin(t * 0.6) * 0.12;   // gentle nutation

      // Parallels (latitude rings)
      for (let i = 1; i < LAT; i++) {
        const phi = -Math.PI / 2 + (Math.PI * i) / LAT;
        const y = Math.sin(phi), r = Math.cos(phi);
        const pts = [];
        for (let j = 0; j <= LON; j++) {
          const th = (2 * Math.PI * j) / LON;
          pts.push(project3d(rotateXY({ x: r * Math.cos(th), y, z: r * Math.sin(th) }, ry, rx), w, h, R, focal));
        }
        strokeDepth(pts, rgb);
      }
      // Meridians (longitude lines)
      for (let j = 0; j < LON; j += 2) {
        const th = (2 * Math.PI * j) / LON;
        const pts = [];
        for (let i = 0; i <= LAT; i++) {
          const phi = -Math.PI / 2 + (Math.PI * i) / LAT;
          const y = Math.sin(phi), r = Math.cos(phi);
          pts.push(project3d(rotateXY({ x: r * Math.cos(th), y, z: r * Math.sin(th) }, ry, rx), w, h, R, focal));
        }
        strokeDepth(pts, rgb);
      }

      // Tilted orbital ring + moving satellite
      const ringPts = [];
      for (let a = 0; a <= 64; a++) {
        const ang = (a / 64) * Math.PI * 2;
        ringPts.push(project3d(rotateXY({ x: Math.cos(ang) * 1.42, y: 0, z: Math.sin(ang) * 1.42 }, ry * 0.6, rx + 0.5), w, h, R, focal));
      }
      ctx.strokeStyle = `rgba(${rgb}, 0.35)`;
      ctx.lineWidth = 1 * devicePixelRatio;
      ctx.beginPath();
      ringPts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();

      const satAng = t * 1.2;
      const sat = project3d(rotateXY({ x: Math.cos(satAng) * 1.42, y: 0, z: Math.sin(satAng) * 1.42 }, ry * 0.6, rx + 0.5), w, h, R, focal);
      ctx.fillStyle = `rgba(255,210,93,0.95)`;
      ctx.shadowColor = 'rgba(255,210,93,0.9)';
      ctx.shadowBlur = 12 * devicePixelRatio;
      ctx.beginPath();
      ctx.arc(sat.x, sat.y, 4 * devicePixelRatio, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Surface beacons — only render when on the near face
      beacons.forEach((b) => {
        const y = Math.sin(b.phi), r = Math.cos(b.phi);
        const p = rotateXY({ x: r * Math.cos(b.th), y, z: r * Math.sin(b.th) }, ry, rx);
        if (p.z > 0.15) return;
        const pr = project3d(p, w, h, R, focal);
        const pulse = 0.5 + Math.sin(t * 3 + b.th) * 0.5;
        ctx.fillStyle = `rgba(${rgb}, ${0.5 + pulse * 0.5})`;
        ctx.shadowColor = `rgba(${rgb}, 0.9)`;
        ctx.shadowBlur = 8 * devicePixelRatio;
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, (2 + pulse * 1.5) * devicePixelRatio, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Glowing core
      ctx.fillStyle = `rgba(${rgb}, 0.9)`;
      ctx.shadowColor = `rgba(${rgb}, 1)`;
      ctx.shadowBlur = 22 * devicePixelRatio;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 3 * devicePixelRatio, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      if (rotOut) rotOut.textContent = ((ry * 180 / Math.PI) % 360).toFixed(1) + '°';
      requestAnimationFrame(frame);
    }

    resize();
    watchResize(canvas, resize);
    frame();
  }

  /* ---------------- SIDEBAR 3D CORE (icosahedron) ---------------- */
  function initCoreHolo() {
    const canvas = document.getElementById('core-holo');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Icosahedron vertices from the golden ratio, normalized to the unit sphere.
    const g = (1 + Math.sqrt(5)) / 2;
    let verts = [
      [-1, g, 0], [1, g, 0], [-1, -g, 0], [1, -g, 0],
      [0, -1, g], [0, 1, g], [0, -1, -g], [0, 1, -g],
      [g, 0, -1], [g, 0, 1], [-g, 0, -1], [-g, 0, 1],
    ].map(([x, y, z]) => {
      const m = Math.hypot(x, y, z);
      return { x: x / m, y: y / m, z: z / m };
    });
    // Connect vertices that sit an edge-length apart (chord ≈ 1.05 on unit sphere).
    const edges = [];
    for (let i = 0; i < verts.length; i++) {
      for (let j = i + 1; j < verts.length; j++) {
        const d = Math.hypot(verts[i].x - verts[j].x, verts[i].y - verts[j].y, verts[i].z - verts[j].z);
        if (d < 1.2) edges.push([i, j]);
      }
    }

    let ry = 0;
    function resize() {
      canvas.width = canvas.clientWidth * devicePixelRatio;
      canvas.height = canvas.clientHeight * devicePixelRatio;
    }

    function frame() {
      const w = canvas.width, h = canvas.height;
      if (w <= 4 || h <= 4) { requestAnimationFrame(frame); return; }
      ctx.clearRect(0, 0, w, h);
      const R = Math.min(w, h) * 0.34;
      const rgb = accentRGB();
      ry += 0.012;
      const rx = ry * 0.4;
      const proj = verts.map((v) => project3d(rotateXY(v, ry, rx), w, h, R, 3));
      edges.forEach(([a, b]) => {
        const zz = (proj[a].z + proj[b].z) / 2;
        const front = 1 - (zz + 1) / 2;
        ctx.strokeStyle = `rgba(${rgb}, ${0.15 + front * 0.5})`;
        ctx.lineWidth = (0.5 + front * 0.8) * devicePixelRatio;
        ctx.beginPath();
        ctx.moveTo(proj[a].x, proj[a].y);
        ctx.lineTo(proj[b].x, proj[b].y);
        ctx.stroke();
      });
      requestAnimationFrame(frame);
    }

    resize();
    watchResize(canvas, resize);
    frame();
  }

  /* ---------------- MOUSE-PARALLAX 3D TILT ---------------- */
  function initTilt() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(hover: none)').matches) return;

    function bind(selector, maxDeg, lift) {
      document.querySelectorAll(selector).forEach((el) => {
        el.addEventListener('mousemove', (e) => {
          const r = el.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          el.style.transition = 'transform .08s linear';
          el.style.transform =
            `perspective(900px) rotateY(${px * maxDeg}deg) rotateX(${-py * maxDeg}deg) translateZ(${lift}px)`;
        });
        el.addEventListener('mouseleave', () => {
          el.style.transition = 'transform .4s cubic-bezier(.2,.8,.2,1)';
          el.style.transform = '';
        });
      });
    }
    bind('.stat-card', 9, 14);
    bind('.panel:not(.panel-holo)', 3.5, 6);
  }

  /* ---------------- MOBILE SIDEBAR (safety net if narrow) ---------------- */
  function initResponsive() {
    // Allow tapping the brand to toggle sidebar on small screens
    const sidebar = document.querySelector('.sidebar');
    document.querySelector('.brand').addEventListener('click', () => {
      if (window.innerWidth <= 980) sidebar.classList.toggle('open');
    });
  }

  /* ---------------- INIT ---------------- */
  function initDashboard() {
    initClock();
    initNav();
    animateCounters();
    initCoreRing();
    initHudDrift();
    initHologram();
    initCoreHolo();
    initRadar();
    initTelemetry();
    initAllocation();
    initRoute();
    initTerminals();
    initCrew();
    initGauges();
    initMatrix();
    initAlerts();
    initSettings();
    initTilt();
    initResponsive();
  }

  document.addEventListener('DOMContentLoaded', () => {
    initStarfield();
    runBootSequence();
  });
})();
