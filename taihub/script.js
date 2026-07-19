/* ============================================================
   T-AI Hub — prototip etkileşim katmanı (saf JS)
   ============================================================ */
(() => {
  'use strict';
  let STAR_COLOR = '#a7c4ff';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  /* ---------------- DATA ---------------- */
  const MODELS = [
    { id: 'gpt4o', name: 'GPT-4o', logo: 'G4', color: '#10a37f', cost: '4 kredi / 1K token', ctx: '128K bağlam', caps: ['Görsel', 'Dosya', 'Uzun bağlam'] },
    { id: 'claude', name: 'Claude Sonnet 4.5', logo: 'C', color: '#d97757', cost: '5 kredi / 1K token', ctx: '200K bağlam', caps: ['Görsel', 'Dosya', 'Uzun bağlam'] },
    { id: 'llama', name: 'Llama 3.1 70B', logo: 'L', color: '#4267b2', cost: '2 kredi / 1K token', ctx: '128K bağlam', caps: ['Açık kaynak', 'Hızlı'] },
    { id: 'mistral', name: 'Mistral Large', logo: 'M', color: '#ff7000', cost: '3 kredi / 1K token', ctx: '64K bağlam', caps: ['Hızlı', 'Çok dilli'] },
    { id: 'phi', name: 'Phi-4', logo: 'φ', color: '#0078d4', cost: '1 kredi / 1K token', ctx: '16K bağlam', caps: ['Ekonomik'] },
  ];

  const SOLUTIONS = [
    { key: 'doc', icon: '📄', name: 'Dokümandan Veri Okuma', engine: 'foundry', cost: 8, desc: 'PDF/Office belgelerinden şema bazlı yapılandırılmış JSON çıkarımı.',
      fields: [{ t: 'file', label: 'Belge (PDF / Word / Excel)' }, { t: 'text', label: 'Çıkarılacak alanlar', ph: 'fatura no, tarih, tutar, KDV…' }] },
    { key: 'cv', icon: '🧑‍💼', name: 'CV Analizi', engine: 'n8n', cost: 12, desc: 'CV parse + pozisyon profiliyle eşleştirme skoru ve gerekçe.',
      fields: [{ t: 'file', label: 'CV dosyaları (toplu)' }, { t: 'textarea', label: 'Pozisyon profili', ph: 'Aranan nitelikler, deneyim, yetkinlikler…' }] },
    { key: 'stt', icon: '🎧', name: 'Sesten Metne (STT)', engine: 'foundry', cost: 6, desc: 'Ses kaydı → konuşmacı ayrımlı transkript + özet ve aksiyon çıkarımı.',
      fields: [{ t: 'file', label: 'Ses dosyası (mp3 / wav / m4a)' }, { t: 'select', label: 'Çıktı', opts: ['Transkript + özet', 'Sadece transkript', 'Toplantı notu şablonu'] }] },
    { key: 'ocr', icon: '🔎', name: 'Görselden Metne (OCR)', engine: 'foundry', cost: 5, desc: 'Fatura/tablo/etiket görsellerinden alan eşlemeli okuma.',
      fields: [{ t: 'file', label: 'Görsel (jpg / png)' }, { t: 'select', label: 'Belge tipi', opts: ['Fatura', 'Tablo', 'Etiket / form'] }] },
    { key: 'plan', icon: '🗂️', name: 'Proje Planlama Asistanı', engine: 'foundry', cost: 10, desc: 'Kapsam → WBS → zaman çizelgesi → risk listesi üretimi.',
      fields: [{ t: 'textarea', label: 'Proje kapsamı', ph: 'Hedef, teslimatlar, kısıtlar…' }, { t: 'text', label: 'Süre / kaynak', ph: 'Örn. 3 ay, 4 kişi' }] },
    { key: 'translate', icon: '🌐', name: 'Çeviri ve Yerelleştirme', engine: 'n8n', cost: 4, desc: 'TR↔EN↔JP kurumsal çeviri; terminoloji sözlüğü destekli.',
      fields: [{ t: 'textarea', label: 'Metin', ph: 'Çevrilecek metin…' }, { t: 'select', label: 'Hedef dil', opts: ['İngilizce', 'Japonca', 'Türkçe'] }] },
    { key: 'anon', icon: '🛡️', name: 'Anonimleştirme Aracı', engine: 'n8n', cost: 3, desc: 'Dokümandaki kişisel verileri maskeleyerek AI\'a güvenli girdi üretir.',
      fields: [{ t: 'file', label: 'Belge' }, { t: 'select', label: 'Maskeleme seviyesi', opts: ['TC + IBAN + isim', 'Tümü (agresif)', 'Sadece TC no'] }] },
    { key: 'rag', icon: '📖', name: 'Bilgi Bankası Soru-Cevap', engine: 'foundry', cost: 6, desc: 'Prosedür ve yönetmelikler üzerinde kaynak atıflı kurumsal Q&A.',
      fields: [{ t: 'select', label: 'Bilgi tabanı', opts: ['İK Prosedürleri', 'Kalite Yönetmelikleri', 'BT Politikaları'] }, { t: 'text', label: 'Soru', ph: 'Örn. yıllık izin devri nasıl işler?' }] },
  ];

  const AGENTS = [
    { name: 'İK Asistanı', dept: 'İnsan Kaynakları', tags: ['izin', 'bordro', 'politika'], uses: 1284, status: 'ok', desc: 'İzin, bordro ve İK politikaları hakkında çalışan sorularını yanıtlar.' },
    { name: 'Satın Alma Yardımcısı', dept: 'Satın Alma', tags: ['tedarikçi', 'sipariş'], uses: 642, status: 'ok', desc: 'Tedarikçi bilgisi ve sipariş durumu sorgular; SAP entegre.' },
    { name: 'Kalite Denetim Botu', dept: 'Kalite', tags: ['ISO', 'denetim'], uses: 318, status: 'warn', desc: 'Kalite prosedürleri ve denetim kontrol listeleri (bakımda).' },
    { name: 'BT Destek Ajanı', dept: 'Bilgi Teknolojileri', tags: ['ticket', 'sıfırlama'], uses: 2104, status: 'ok', desc: 'Şifre sıfırlama, yazılım talebi ve BT ticket açma.' },
    { name: 'Satış Koçu', dept: 'Satış', tags: ['pitch', 'CRM'], uses: 471, status: 'ok', desc: 'Satış senaryoları, itiraz karşılama ve CRM özetleri.' },
    { name: 'Hukuk Gözden Geçirici', dept: 'Hukuk', tags: ['sözleşme', 'risk'], uses: 156, status: 'ok', desc: 'Sözleşme maddesi tarama ve risk işaretleme (bilgilendirme amaçlı).' },
  ];

  const SHOWCASE = [
    { title: 'Fatura Otomasyonu', cat: 'Çözüm', dept: 'Finans', status: 'Canlı', desc: 'Gelen faturaları otomatik okuyup ERP\'ye yazar. Aylık ~40 saat tasarruf.', metric: '%92 doğruluk' },
    { title: 'İK Asistanı', cat: 'Ajan', dept: 'İnsan Kaynakları', status: 'Canlı', desc: 'Çalışan sorularının %70\'ini insan müdahalesi olmadan yanıtlar.', metric: '1.284 kullanım' },
    { title: 'Toplantı Asistanı', cat: 'Proje', dept: 'Bilgi Teknolojileri', status: 'Pilot', desc: 'Teams kayıtlarından özet, karar ve aksiyon maddeleri çıkarır.', metric: 'Pilot: 3 ekip' },
    { title: 'Tedarikçi Risk MCP', cat: 'MCP', dept: 'Satın Alma', status: 'Geliştirmede', desc: 'Tedarikçi finansal ve uyum verisini ajanlara açan MCP sunucusu.', metric: '5 tool' },
    { title: 'CV Ön Eleme', cat: 'Çözüm', dept: 'İnsan Kaynakları', status: 'Canlı', desc: 'Başvuruları pozisyona göre skorlar, İK\'ya sıralı liste sunar.', metric: '%60 hızlanma' },
    { title: 'Global Çeviri Hattı', cat: 'Proje', dept: 'Kurumsal İletişim', status: 'Fikir', desc: 'TR-EN-JP kurumsal yazışma çevirisi, terminoloji sözlüğü destekli.', metric: 'Değerlendirmede' },
  ];

  const LIBS = {
    prompt: { label: 'Prompt', items: [
      { title: 'Toplantı Özeti Çıkar', tags: ['özet', 'toplantı'], copies: 412, body: 'Aşağıdaki toplantı transkriptini özetle. Katılımcılar, alınan kararlar ve {{sorumlu}} bazında aksiyon maddelerini madde madde listele.' },
      { title: 'Kurumsal E-posta Taslağı', tags: ['e-posta', 'TR'], copies: 388, body: '{{konu}} hakkında {{alıcı}}\'ya resmi ama sıcak bir kurumsal e-posta taslağı yaz. Ton: profesyonel.' },
      { title: 'Sözleşme Risk Taraması', tags: ['hukuk'], copies: 205, body: 'Aşağıdaki sözleşme metnindeki riskli maddeleri (cayma, ceza, gizlilik) tespit et ve her biri için kısa gerekçe ver.' },
    ]},
    skill: { label: 'Skill', items: [
      { title: 'Rapor Yazım Becerisi', tags: ['rapor', 'md'], copies: 176, body: 'Talimat + örnekler içeren, indirilebilir beceri paketi (yönetici özeti → bulgular → öneri şablonu).' },
      { title: 'Veri Doğrulama Becerisi', tags: ['kalite'], copies: 98, body: 'Çıkarılan alanları şema kurallarına göre doğrulayan beceri paketi.' },
    ]},
    rule: { label: 'Rule', items: [
      { title: 'Kurumsal Yazım Kuralları', tags: ['ton', 'TR'], copies: 254, body: 'Toyota kurumsal dil rehberi: kısaltmalar, marka adları, ton ve hitap kuralları.' },
      { title: 'Ekip Çalışma Kuralları', tags: ['mühendislik'], copies: 61, body: 'Cursor/Claude rules formatında dışa aktarılabilir ekip kuralları.' },
    ]},
    guardrail: { label: 'Guardrail', items: [
      { title: 'PII Maskeleme Politikası', tags: ['KVKK', 'enforced'], copies: 143, enforced: true, body: 'TC kimlik, IBAN ve müşteri verisi kalıplarını modele gitmeden maskele.' },
      { title: 'Yasaklı Konu Filtresi', tags: ['güvenlik', 'enforced'], copies: 119, enforced: true, body: 'Rekabet hukuku, kişisel finans tavsiyesi ve gizli proje kod adları için engelleme.' },
    ]},
    persona: { label: 'Persona', items: [
      { title: 'İK Asistanı Personası', tags: ['İK'], copies: 87, body: 'Empatik, prosedüre hakim, kısa ve net yanıt veren İK asistanı sistem kişiliği.' },
      { title: 'Hukuk Gözden Geçirici', tags: ['hukuk'], copies: 64, body: 'Temkinli, riskleri işaretleyen, kesin hüküm vermeyen gözden geçirici personası.' },
    ]},
  };

  const MCPS = [
    { name: 'sap-tedarik', desc: 'SAP tedarikçi ve sipariş verisine salt-okunur erişim.', ver: 'v1.3.0', health: 'ok', cls: 'İç', owner: 'Satın Alma', tools: ['getSupplier', 'listOrders', 'getOrderStatus'] },
    { name: 'sharepoint-docs', desc: 'Kurumsal SharePoint doküman arama ve içerik getirme.', ver: 'v2.0.1', health: 'ok', cls: 'İç', owner: 'BT', tools: ['searchDocs', 'getDocument', 'listSites'] },
    { name: 'kalite-kb', desc: 'Kalite yönetmelikleri bilgi bankası (RAG) sorgulama.', ver: 'v0.9.4', health: 'warn', cls: 'Genel', owner: 'Kalite', tools: ['query', 'getSource'] },
    { name: 'crm-musteri', desc: 'CRM müşteri kaydı ve etkileşim geçmişi (gizli veri).', ver: 'v1.1.2', health: 'ok', cls: 'Gizli', owner: 'Satış', tools: ['getCustomer', 'getInteractions'] },
  ];

  const TRAINING = [
    { icon: '🚀', bg: '#e9f0fe', title: 'AI\'a Giriş', lessons: 6, pct: 100 },
    { icon: '✍️', bg: '#fdeaec', title: 'Etkili Prompt Yazımı', lessons: 8, pct: 45 },
    { icon: '🧭', bg: '#e6f6ec', title: 'Platform 101', lessons: 5, pct: 20 },
    { icon: '🤖', bg: '#efe7ff', title: 'Copilot Studio ile Ajan', lessons: 7, pct: 0 },
    { icon: '🔌', bg: '#fbf1e2', title: 'MCP Nedir?', lessons: 4, pct: 0 },
    { icon: '🛡️', bg: '#e9f0fe', title: 'Güvenli AI Kullanımı & KVKK', lessons: 5, pct: 60 },
  ];

  const NOTIFS = [
    { ic: '✅', bg: 'var(--ok-weak)', t: 'Ek kredi talebin onaylandı', p: '1.000 kredi bonus cüzdanına eklendi.', time: '5 dk önce' },
    { ic: '📄', bg: 'var(--info-weak)', t: 'Çözüm tamamlandı', p: 'CV Analizi çalıştırman hazır — sonucu görüntüle.', time: '22 dk önce' },
    { ic: '🎓', bg: 'var(--warn-weak)', t: 'Zorunlu eğitim hatırlatması', p: '"Güvenli AI Kullanımı" eğitimini 30 Tem\'e kadar tamamla.', time: '1 saat önce' },
    { ic: '✨', bg: 'var(--accent-weak)', t: 'Yeni model yayında', p: 'Claude Sonnet 4.5 artık sohbet ekranında.', time: '3 saat önce' },
  ];

  /* ---------------- CANVAS HELPERS ---------------- */
  function ring(canvas, pct, color, opts = {}) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - (opts.lw || 6) * dpr;
    ctx.lineWidth = (opts.lw || 6) * dpr;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(120,150,220,0.14)'; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
    ctx.strokeStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 8 * dpr; ctx.stroke(); ctx.shadowBlur = 0;
    if (opts.label) {
      ctx.fillStyle = getVar('--text'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `600 ${opts.fs || 20 * dpr}px 'IBM Plex Sans'`;
      ctx.fillText(opts.label, cx, cy - (opts.sub ? 8 * dpr : 0));
      if (opts.sub) { ctx.fillStyle = getVar('--text-3'); ctx.font = `${11 * dpr}px 'IBM Plex Sans'`; ctx.fillText(opts.sub, cx, cy + 12 * dpr); }
    }
  }
  function getVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }

  function barChart(canvas, values, labels, color) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr; canvas.height = 240 * dpr;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const pad = 30 * dpr, bottom = h - 26 * dpr, top = 14 * dpr;
    const max = Math.max(...values) * 1.15;
    ctx.strokeStyle = getVar('--border'); ctx.lineWidth = 1;
    ctx.fillStyle = getVar('--text-3'); ctx.font = `${10 * dpr}px 'IBM Plex Sans'`; ctx.textAlign = 'right';
    for (let i = 0; i <= 3; i++) {
      const y = top + (bottom - top) * (i / 3);
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - 6 * dpr, y); ctx.stroke();
      ctx.fillText(Math.round(max - (max * i / 3)), pad - 6 * dpr, y + 3 * dpr);
    }
    const bw = (w - pad - 12 * dpr) / values.length;
    values.forEach((v, i) => {
      const bh = (v / max) * (bottom - top);
      const x = pad + i * bw + bw * 0.22, bwid = bw * 0.56;
      ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 10 * dpr; roundRect(ctx, x, bottom - bh, bwid, bh, 4 * dpr); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = getVar('--text-3'); ctx.textAlign = 'center'; ctx.font = `${10 * dpr}px 'IBM Plex Sans'`;
      ctx.fillText(labels[i], x + bwid / 2, bottom + 16 * dpr);
    });
  }
  function lineChart(canvas, series, color) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr; canvas.height = 220 * dpr;
    const w = canvas.width, h = canvas.height, pad = 30 * dpr, top = 14 * dpr, bottom = h - 24 * dpr;
    ctx.clearRect(0, 0, w, h);
    const max = Math.max(...series) * 1.2;
    ctx.strokeStyle = getVar('--border');
    for (let i = 0; i <= 3; i++) { const y = top + (bottom - top) * i / 3; ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - 6 * dpr, y); ctx.stroke(); }
    const step = (w - pad - 12 * dpr) / (series.length - 1);
    ctx.beginPath();
    series.forEach((v, i) => { const x = pad + i * step, y = bottom - (v / max) * (bottom - top); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.strokeStyle = color; ctx.lineWidth = 2.4 * dpr; ctx.lineJoin = 'round'; ctx.shadowColor = color; ctx.shadowBlur = 12 * dpr; ctx.stroke(); ctx.shadowBlur = 0;
    ctx.lineTo(w - 6 * dpr, bottom); ctx.lineTo(pad, bottom); ctx.closePath();
    const grad = ctx.createLinearGradient(0, top, 0, bottom); grad.addColorStop(0, hexA(color, .18)); grad.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = grad; ctx.fill();
  }
  function donut(canvas, data) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr; canvas.height = 220 * dpr;
    const w = canvas.width, h = canvas.height, cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 10 * dpr;
    ctx.clearRect(0, 0, w, h);
    let a = -Math.PI / 2; const tot = data.reduce((s, d) => s + d.v, 0);
    data.forEach(d => { const sl = d.v / tot * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, a, a + sl); ctx.closePath(); ctx.fillStyle = d.c; ctx.fill(); a += sl; });
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2); ctx.fillStyle = getVar('--surface-solid'); ctx.fill();
  }
  function roundRect(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function hexA(hex, a) { const c = hex.replace('#', ''); const n = parseInt(c.length === 3 ? c.split('').map(x => x + x).join('') : c, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }

  /* ---------------- TOAST / MODAL ---------------- */
  function toast(title, msg, kind = '') {
    const t = el('div', 'toast ' + kind, `<span class="t-ic">${kind === 'ok' ? '✅' : kind === 'info' ? 'ℹ️' : '🔔'}</span><div><b>${title}</b>${msg ? `<p>${msg}</p>` : ''}</div>`);
    $('#toast-wrap').appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3400);
  }
  function openModal(html) { $('#modal-inner').innerHTML = html; $('#modal').classList.add('open'); }
  function closeModal() { $('#modal').classList.remove('open'); }
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

  /* ---------------- LOGIN ---------------- */
  function enterApp() { $('#login').classList.add('hidden'); $('#app').classList.remove('hidden'); maybeStartTour(); }
  $('#sso-btn').addEventListener('click', enterApp);
  $('#static-form').addEventListener('submit', e => { e.preventDefault(); enterApp(); });
  $('#static-toggle').addEventListener('click', () => $('#static-form').classList.toggle('open'));

  /* ---------------- NAV / VIEW SWITCH ---------------- */
  const TITLES = { dashboard: 'Ana Sayfa', chat: 'AI Sohbet', solutions: 'Operasyonel AI', agents: 'Copilot Ajanları', showcase: 'AI Vitrini', libraries: 'Kütüphaneler', mcp: 'MCP Hub', training: 'Eğitim Merkezi', credits: 'Kredi & Kullanım', history: 'Geçmişim', admin: 'Yönetim Paneli' };
  function goto(view) {
    $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));
    $$('.view').forEach(v => v.classList.toggle('active', v.id === 'v-' + view));
    $('#page-title').textContent = TITLES[view] || '';
    $('#content').scrollTop = 0;
    $('#sidebar').classList.remove('open');
    runProgress();
    revealView('v-' + view);
    if (view === 'credits') drawCredits();
    if (view === 'admin') drawAdminCharts();
  }
  function runProgress() {
    const p = $('#nav-progress'); if (!p) return;
    p.classList.remove('run'); void p.offsetWidth; p.classList.add('run');
  }
  // active görünümün kartlarını sırayla belirt (yumuşak geçiş)
  function revealView(id) {
    if (document.body.classList.contains('reduce-motion')) return;
    const v = document.getElementById(id); if (!v || v.classList.contains('full')) return;
    const items = [...v.querySelectorAll('.stat-card, .acard, .card, .panel, .path-card')];
    items.forEach((it, i) => {
      it.classList.remove('reveal-item'); it.style.animationDelay = '';
      void it.offsetWidth;
      it.style.animationDelay = Math.min(i, 9) * 0.045 + 's';
      it.classList.add('reveal-item');
    });
  }
  $$('.nav-item').forEach(n => n.addEventListener('click', () => goto(n.dataset.view)));
  document.addEventListener('click', e => { const g = e.target.closest('[data-goto]'); if (g) goto(g.dataset.goto); });
  $('#menu-btn').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

  /* ---------------- ACCENT (kırmızı ↔ cyan neon) ---------------- */
  function applyAccent(a) {
    document.documentElement.setAttribute('data-accent', a);
    $('#theme-ico').innerHTML = '<path d="M12 3c3.2 4 6 7 6 11a6 6 0 0 1-12 0c0-4 2.8-7 6-11z"/>';
    $('#theme-ico').setAttribute('fill', a === 'cyan' ? '#22e0ff' : '#ff2e43');
    $('#theme-ico').setAttribute('stroke', 'none');
    redrawRings();
    if ($('#v-credits').classList.contains('active')) drawCredits();
    if ($('#v-admin').classList.contains('active')) drawAdminCharts();
  }
  $('#theme-btn').setAttribute('title', 'Vurgu rengi: kırmızı / cyan');
  let accent = 'red'; applyAccent('red');
  $('#theme-btn').addEventListener('click', () => { accent = accent === 'red' ? 'cyan' : 'red'; applyAccent(accent); toast('Vurgu rengi', accent === 'cyan' ? 'Cyan neon' : 'Kırmızı neon', 'info'); });

  /* ---------------- AÇIK / KOYU MOD ---------------- */
  const SUN = '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7"/>';
  const MOON = '<path d="M20.5 13.3A8.2 8.2 0 1 1 10.7 3.5 6.4 6.4 0 0 0 20.5 13.3z"/>';
  function applyMode(m) {
    document.documentElement.setAttribute('data-mode', m);
    STAR_COLOR = m === 'light' ? 'rgba(90,110,150,0.9)' : '#a7c4ff';
    $('#mode-ico').innerHTML = m === 'light' ? MOON : SUN;   // gösterilen ikon = geçilecek mod
    redrawRings();
    if ($('#v-credits').classList.contains('active')) drawCredits();
    if ($('#v-admin').classList.contains('active')) drawAdminCharts();
    try { localStorage.setItem('taihub_mode', m); } catch (e) {}
  }
  let mode = 'dark';
  try { mode = localStorage.getItem('taihub_mode') || 'dark'; } catch (e) {}
  applyMode(mode);
  $('#mode-btn').addEventListener('click', () => { mode = mode === 'dark' ? 'light' : 'dark'; applyMode(mode); toast('Görünüm', mode === 'light' ? 'Açık tema' : 'Koyu tema', 'info'); });

  /* ---------------- STARFIELD ---------------- */
  function initStars() {
    const c = $('#bg-stars'); if (!c) return;
    const ctx = c.getContext('2d'); let w, h, stars = [];
    function resize() { w = c.width = innerWidth; h = c.height = innerHeight; const n = Math.floor(w * h / 9000); stars = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, z: Math.random() * 1.3 + 0.3, r: Math.random() * 1.2 + 0.3, tw: Math.random() * 6.28 })); }
    function draw() {
      ctx.clearRect(0, 0, w, h);
      const moving = !document.body.classList.contains('reduce-motion');
      for (const s of stars) {
        if (moving) { s.x -= s.z * 0.11; s.tw += 0.014; if (s.x < -3) s.x = w + 3; }
        const a = 0.32 + Math.sin(s.tw) * 0.3;
        ctx.globalAlpha = Math.max(0, a); ctx.fillStyle = STAR_COLOR;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.28); ctx.fill();
      }
      ctx.globalAlpha = 1; requestAnimationFrame(draw);
    }
    addEventListener('resize', resize); resize(); draw();
  }

  /* ---------------- NOTIFICATIONS ---------------- */
  $('#notif-list').innerHTML = NOTIFS.map(n => `<div class="notif-item"><div class="n-ic" style="background:${n.bg}">${n.ic}</div><div><b>${n.t}</b><p>${n.p}</p><div class="n-t">${n.time}</div></div></div>`).join('');
  $('#notif-btn').addEventListener('click', e => { e.stopPropagation(); $('#notif-pop').classList.toggle('open'); });
  document.addEventListener('click', e => { if (!e.target.closest('#notif-pop') && !e.target.closest('#notif-btn')) $('#notif-pop').classList.remove('open'); });
  $('#notif-clear').addEventListener('click', () => { $('.icon-btn .badge').style.display = 'none'; $('.nav-badge')?.remove?.(); toast('Bildirimler okundu', ''); });

  /* ---------------- RINGS ---------------- */
  function redrawRings() {
    ring($('#cp-ring'), 1840 / 3000, getVar('--accent'), { lw: 4 });
    if ($('#hc-ring')) ring($('#hc-ring'), 1840 / 3000, getVar('--accent'), { lw: 9, label: '61%', sub: 'kalan', fs: 34, });
  }

  /* ---------------- DASHBOARD ---------------- */
  function renderDashboard() {
    $('#dash-showcase').innerHTML = SHOWCASE.slice(0, 4).map(s => showcaseCard(s)).join('');
    $('#dash-announce').innerHTML = [
      { t: 'Claude Sonnet 4.5 sohbete eklendi', p: 'Uzun bağlam ve görsel destekli yeni model artık yayında.', time: 'Bugün' },
      { t: '"Etkili Prompt Yazımı" eğitimi güncellendi', p: '3 yeni ders ve quiz eklendi.', time: 'Dün' },
      { t: 'Kredi politikası güncellendi', p: 'Mühendislik departmanı günlük limiti 3.000 krediye çıkarıldı.', time: '3 gün önce' },
    ].map(a => `<div class="announce"><span class="a-dot"></span><div class="a-body"><b>${a.t}</b><p>${a.p}</p></div><span class="a-time">${a.time}</span></div>`).join('');
    $('#dash-training').innerHTML = TRAINING.filter(t => t.pct > 0 && t.pct < 100).map(t => `
      <div style="padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:7px"><b>${t.icon} ${t.title}</b><span class="dim">%${t.pct}</span></div>
        <div class="bar ok"><i style="width:${t.pct}%"></i></div>
      </div>`).join('');
  }

  /* ---------------- SHOWCASE / cards ---------------- */
  const STATUS_CLS = { 'Canlı': 'ok', 'Pilot': 'info', 'Geliştirmede': 'warn', 'Fikir': '' };
  function showcaseCard(s) {
    return `<div class="acard"><div class="ac-top"><div class="ac-ico">${s.title[0]}</div><span class="chip ${STATUS_CLS[s.status]}"><span class="dt"></span>${s.status}</span></div>
      <div class="ac-body"><h4>${s.title}</h4><div class="ac-desc">${s.desc}</div>
      <div class="ac-meta"><span class="chip">${s.cat}</span><span>${s.dept}</span></div></div>
      <div class="ac-foot"><b style="font-size:12.5px;color:var(--ok)">${s.metric}</b><button class="btn ghost sm">Detay ›</button></div></div>`;
  }
  function renderShowcase() {
    const cats = ['Tümü', 'Ajan', 'Proje', 'Çözüm', 'MCP'];
    $('#showcase-filter').innerHTML = cats.map((c, i) => `<button class="fchip ${i === 0 ? 'active' : ''}" data-cat="${c}">${c}</button>`).join('');
    const draw = (cat) => $('#showcase-catalog').innerHTML = SHOWCASE.filter(s => cat === 'Tümü' || s.cat === cat).map(showcaseCard).join('');
    draw('Tümü');
    $('#showcase-filter').addEventListener('click', e => { const b = e.target.closest('.fchip'); if (!b) return; $$('#showcase-filter .fchip').forEach(x => x.classList.remove('active')); b.classList.add('active'); draw(b.dataset.cat); });
  }

  /* ---------------- AGENTS ---------------- */
  function renderAgents() {
    const depts = ['Tümü', ...new Set(AGENTS.map(a => a.dept))];
    $('#agents-filter').innerHTML = depts.map((d, i) => `<button class="fchip ${i === 0 ? 'active' : ''}" data-d="${d}">${d}</button>`).join('');
    const card = a => `<div class="acard"><div class="ac-top"><div class="ac-ico">🤖</div><span class="chip ${a.status === 'ok' ? 'ok' : 'warn'}"><span class="dt"></span>${a.status === 'ok' ? 'Aktif' : 'Bakımda'}</span></div>
      <div class="ac-body"><h4>${a.name}</h4><div class="ac-desc">${a.desc}</div><div class="tag-row">${a.tags.map(t => `<span class="chip">#${t}</span>`).join('')}</div>
      <div class="ac-meta"><span>${a.dept}</span><span>·</span><span>${a.uses.toLocaleString('tr')} kullanım</span></div></div>
      <div class="ac-foot"><span class="dim" style="font-size:11.5px">SSO ile kimlik taşınır</span><button class="btn primary sm" data-goto="chat">Konuş</button></div></div>`;
    const draw = d => $('#agents-catalog').innerHTML = AGENTS.filter(a => d === 'Tümü' || a.dept === d).map(card).join('');
    draw('Tümü');
    $('#agents-filter').addEventListener('click', e => { const b = e.target.closest('.fchip'); if (!b) return; $$('#agents-filter .fchip').forEach(x => x.classList.remove('active')); b.classList.add('active'); draw(b.dataset.d); });
  }

  /* ---------------- LIBRARIES ---------------- */
  function renderLibraries() {
    const keys = Object.keys(LIBS);
    $('#lib-tabs').innerHTML = keys.map((k, i) => `<button class="tab ${i === 0 ? 'active' : ''}" data-lib="${k}">${LIBS[k].label} <span class="dim">(${LIBS[k].items.length})</span></button>`).join('');
    const draw = k => $('#lib-content').innerHTML = LIBS[k].items.map(it => `
      <div class="acard"><div class="ac-body"><div style="display:flex;justify-content:space-between;align-items:start;gap:8px"><h4>${it.title}</h4>${it.enforced ? '<span class="chip red">enforced</span>' : ''}</div>
      <div class="ac-desc mono" style="font-size:11.5px;background:var(--surface-2);padding:10px;border-radius:6px;border:1px solid var(--border)">${it.body}</div>
      <div class="tag-row">${it.tags.map(t => `<span class="chip">#${t}</span>`).join('')}</div></div>
      <div class="ac-foot"><span class="dim" style="font-size:11.5px">${it.copies} kopyalama</span><div style="display:flex;gap:6px"><button class="btn ghost sm lib-copy">Kopyala</button><button class="btn outline sm" data-goto="chat">Chat'te aç</button></div></div></div>`).join('');
    draw(keys[0]);
    $('#lib-tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (!b) return; $$('#lib-tabs .tab').forEach(x => x.classList.remove('active')); b.classList.add('active'); draw(b.dataset.lib); });
    $('#lib-content').addEventListener('click', e => { if (e.target.classList.contains('lib-copy')) toast('Kopyalandı', 'İçerik panoya kopyalandı.', 'ok'); });
  }

  /* ---------------- SOLUTIONS ---------------- */
  function renderSolutions() {
    $('#solutions-catalog').innerHTML = SOLUTIONS.map(s => `
      <div class="acard sol-card" data-key="${s.key}"><div class="ac-top"><div class="ac-ico">${s.icon}</div><span class="engine-badge engine-${s.engine}">${s.engine === 'foundry' ? 'Foundry' : 'n8n'}</span></div>
      <div class="ac-body"><h4>${s.name}</h4><div class="ac-desc">${s.desc}</div></div>
      <div class="ac-foot"><span class="dim" style="font-size:11.5px">~${s.cost} kredi</span><button class="btn primary sm">Çalıştır ›</button></div></div>`).join('');
    $$('.sol-card').forEach(c => c.addEventListener('click', () => openSolution(c.dataset.key)));
    $('#sol-back').addEventListener('click', () => { $('#solution-detail').style.display = 'none'; $('#solutions-catalog').style.display = 'grid'; });
    $('#sol-run').addEventListener('click', runSolution);
  }
  let currentSol = null;
  function openSolution(key) {
    const s = SOLUTIONS.find(x => x.key === key); currentSol = s;
    $('#solutions-catalog').style.display = 'none';
    $('#solution-detail').style.display = 'block';
    $('#sol-title').textContent = s.name; $('#sol-desc').textContent = s.desc;
    $('#sol-engine').innerHTML = `<span class="engine-badge engine-${s.engine}">Motor: ${s.engine === 'foundry' ? 'Azure AI Foundry' : 'n8n'}</span>`;
    $('#sol-cost').textContent = s.cost + ' kredi';
    $('#sol-form').innerHTML = s.fields.map(f => {
      if (f.t === 'file') return `<div class="field" style="margin-bottom:12px"><label>${f.label}</label><div class="input" style="border-style:dashed;text-align:center;color:var(--text-3);cursor:pointer">⬆ Dosya seç veya sürükle</div></div>`;
      if (f.t === 'textarea') return `<div class="field" style="margin-bottom:12px"><label>${f.label}</label><textarea class="textarea" placeholder="${f.ph || ''}"></textarea></div>`;
      if (f.t === 'select') return `<div class="field" style="margin-bottom:12px"><label>${f.label}</label><select class="select">${f.opts.map(o => `<option>${o}</option>`).join('')}</select></div>`;
      return `<div class="field" style="margin-bottom:12px"><label>${f.label}</label><input class="input" placeholder="${f.ph || ''}"></div>`;
    }).join('');
    $('#sol-result').innerHTML = `<div class="run-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>Formu doldurup <b>Çalıştır</b>'a bas.</div>`;
    $('#sol-export').style.display = 'none';
  }
  const SOL_RESULTS = {
    doc: '{\n  "faturaNo": "TR-2026-004821",\n  "tarih": "2026-07-12",\n  "tedarikci": "Delta Otomotiv A.Ş.",\n  "tutar": 148500.00,\n  "kdv": 29700.00,\n  "paraBirimi": "TRY",\n  "guven": 0.96\n}',
    cv: '[\n  { "aday": "A. Yılmaz", "skor": 92, "gerekce": "5 yıl ilgili deneyim, aranan 3 yetkinliğin tamamı" },\n  { "aday": "M. Demir", "skor": 78, "gerekce": "Deneyim uygun, sertifika eksik" },\n  { "aday": "S. Kaya", "skor": 61, "gerekce": "Pozisyon profiliyle kısmi örtüşme" }\n]',
    stt: '{\n  "sure": "12:44",\n  "konusmaci": 3,\n  "ozet": "Q3 lansman takvimi ve tedarik riskleri görüşüldü.",\n  "aksiyonlar": [\n    "Tedarik ekibi alternatif tedarikçi listesi hazırlayacak (Ali)",\n    "Pazarlama lansman tarihini 2 hafta öne çekmeyi değerlendirecek"\n  ]\n}',
    ocr: '{\n  "belgeTipi": "Fatura",\n  "alanlar": { "toplam": 4820.50, "kdv": 964.10, "tarih": "2026-06-30" },\n  "tablolar": 1,\n  "guven": 0.91\n}',
    plan: '{\n  "wbs": ["Analiz (2 hf)", "Tasarım (3 hf)", "Geliştirme (6 hf)", "Test (2 hf)"],\n  "riskler": ["Kapsam genişlemesi", "Kaynak müsaitliği"],\n  "kilometreTaslari": ["MVP: 8. hafta", "Canlı: 13. hafta"]\n}',
    translate: '{\n  "kaynak": "TR",\n  "hedef": "EN",\n  "ceviri": "The Q3 launch schedule has been reviewed and approved by the steering committee.",\n  "terimSozlugu": ["lansman → launch"]\n}',
    anon: '{\n  "maskelenen": { "tcKimlik": 2, "iban": 1, "isim": 3 },\n  "ciktiHazir": true,\n  "not": "Maskelenmiş belge AI\'a güvenle girilebilir."\n}',
    rag: '{\n  "cevap": "Yıllık izin, bir sonraki yıla en fazla 5 gün devredilebilir; fazlası hak kaybıdır.",\n  "kaynak": "İK Prosedürü PR-14, Madde 6.3",\n  "guven": 0.94\n}',
  };
  function runSolution() {
    if (!currentSol) return;
    const box = $('#sol-result');
    box.innerHTML = `<div class="run-empty"><div class="typing"><i></i><i></i><i></i></div>${currentSol.engine === 'foundry' ? 'Azure AI Foundry' : 'n8n akışı'} çalışıyor…</div>`;
    setTimeout(() => {
      box.innerHTML = `<div style="margin-bottom:10px" class="chip ok"><span class="dt"></span>Tamamlandı · ${currentSol.cost} kredi harcandı</div><pre class="result-json">${SOL_RESULTS[currentSol.key]}</pre><button class="btn outline sm" style="margin-top:12px" data-goto="chat">↗ Sohbete aktar</button>`;
      $('#sol-export').style.display = 'inline-flex';
      toast('Çözüm tamamlandı', currentSol.name + ' sonucu hazır.', 'ok');
    }, 1500);
  }

  /* ---------------- MCP ---------------- */
  const HEALTH = { ok: ['ok', 'Sağlıklı'], warn: ['warn', 'Uyarı'] };
  let myKeys = [
    { name: 'IDE bağlantım', server: 'sharepoint-docs', prefix: 'tt_mcp_9f3a', last: '2 saat önce', exp: '2026-12-31' },
  ];
  function renderMcp() {
    $('#mcp-grid').innerHTML = MCPS.map(m => `
      <div class="acard"><div class="ac-top"><div class="ac-ico">🔌</div><span class="chip ${m.health === 'ok' ? 'ok' : 'warn'}"><span class="dt"></span>${HEALTH[m.health][1]}</span></div>
      <div class="ac-body"><div style="display:flex;justify-content:space-between;align-items:center"><h4 class="mono">${m.name}</h4><span class="chip">${m.ver}</span></div>
      <div class="ac-desc">${m.desc}</div>
      <div class="tool-list">${m.tools.map(t => `<div class="tool-item"><span class="t-name">${t}()</span></div>`).join('')}</div>
      <div class="ac-meta"><span class="chip ${m.cls === 'Gizli' ? 'red' : m.cls === 'İç' ? 'warn' : ''}">${m.cls}</span><span>${m.owner}</span></div></div>
      <div class="ac-foot"><span class="dim" style="font-size:11.5px">${m.tools.length} tool</span><button class="btn primary sm mcp-key" data-name="${m.name}">Key oluştur</button></div></div>`).join('');
    $$('.mcp-key').forEach(b => b.addEventListener('click', () => keyModal(b.dataset.name)));
    renderKeys();
  }
  function renderKeys() {
    $('#mcp-keys-tbl').innerHTML = `<thead><tr><th>Ad</th><th>MCP Sunucusu</th><th>Prefix</th><th>Son kullanım</th><th>Son geçerlilik</th><th></th></tr></thead><tbody>${myKeys.map((k, i) => `<tr><td class="cell-strong">${k.name}</td><td class="mono">${k.server}</td><td class="mono dim">${k.prefix}…</td><td>${k.last}</td><td>${k.exp}</td><td style="text-align:right"><button class="btn ghost sm key-revoke" data-i="${i}" style="color:var(--accent)">İptal et</button></td></tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text-3);padding:24px">Henüz key oluşturmadın.</td></tr>'}</tbody>`;
    $$('.key-revoke').forEach(b => b.addEventListener('click', () => { myKeys.splice(+b.dataset.i, 1); renderKeys(); toast('Key iptal edildi', ''); }));
  }
  function keyModal(server) {
    const key = 'tt_mcp_' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
    openModal(`
      <div class="modal-head"><h3>Key oluştur · <span class="mono">${server}</span></h3><button class="x" onclick="">✕</button></div>
      <div class="modal-body">
        <div class="field"><label>Key adı</label><input class="input" id="k-name" placeholder="Örn. Claude Desktop bağlantım"></div>
        <div class="field"><label>Son geçerlilik</label><input class="input" type="date" id="k-exp" value="2026-12-31"></div>
        <div id="k-created" style="display:none">
          <label style="font-size:12.5px;font-weight:600;color:var(--text-2)">Key'in (yalnızca bir kez gösterilir)</label>
          <div class="key-box" style="margin-top:6px"><span id="k-value">${key}</span><button class="btn outline sm" id="k-copy">Kopyala</button></div>
          <div style="margin:16px 0 8px">
            <div class="snippet-tabs" id="snip-tabs">
              <button class="snippet-tab active" data-s="claude">Claude Desktop</button>
              <button class="snippet-tab" data-s="vscode">VS Code</button>
              <button class="snippet-tab" data-s="n8n">n8n</button>
            </div>
            <pre class="code-block" id="snip-body"></pre>
          </div>
        </div>
      </div>
      <div class="modal-foot" id="k-foot">
        <button class="btn outline" id="k-cancel">Vazgeç</button>
        <button class="btn primary" id="k-create">Key oluştur</button>
      </div>`);
    const snippets = {
      claude: `{\n  "mcpServers": {\n    "${server}": {\n      "url": "https://mcp.taihub.toyota.com.tr/${server}",\n      "headers": { "Authorization": "Bearer ${key}" }\n    }\n  }\n}`,
      vscode: `// .vscode/mcp.json\n{\n  "servers": {\n    "${server}": {\n      "type": "http",\n      "url": "https://mcp.taihub.toyota.com.tr/${server}",\n      "headers": { "Authorization": "Bearer ${key}" }\n    }\n  }\n}`,
      n8n: `// n8n MCP Client node\nEndpoint: https://mcp.taihub.toyota.com.tr/${server}\nAuth Header: Authorization = Bearer ${key}\nTransport: Streamable HTTP`,
    };
    $('#modal-inner .x').addEventListener('click', closeModal);
    $('#k-cancel').addEventListener('click', closeModal);
    $('#k-create').addEventListener('click', () => {
      const name = $('#k-name').value.trim() || 'Yeni key';
      $('#k-created').style.display = 'block';
      $('#k-foot').innerHTML = '<button class="btn primary" id="k-done">Bitti</button>';
      $('#snip-body').textContent = snippets.claude;
      $('#k-done').addEventListener('click', closeModal);
      myKeys.unshift({ name, server, prefix: key.slice(0, 11), last: 'az önce', exp: $('#k-exp').value });
      renderKeys();
      toast('Key oluşturuldu', 'Key yalnızca bir kez gösterilir — güvenle sakla.', 'ok');
    });
    $('#snip-tabs')?.addEventListener('click', e => { const b = e.target.closest('.snippet-tab'); if (!b) return; $$('#snip-tabs .snippet-tab').forEach(x => x.classList.remove('active')); b.classList.add('active'); $('#snip-body').textContent = snippets[b.dataset.s]; });
    document.addEventListener('click', e => { if (e.target.id === 'k-copy') toast('Kopyalandı', 'Key panoya kopyalandı.', 'ok'); });
  }
  $('#mcp-tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (!b) return; $$('#mcp-tabs .tab').forEach(x => x.classList.remove('active')); b.classList.add('active'); $('#mcp-catalog').classList.toggle('active', b.dataset.mcp === 'catalog'); $('#mcp-keys').classList.toggle('active', b.dataset.mcp === 'keys'); });

  /* ---------------- TRAINING ---------------- */
  function renderTraining() {
    $('#training-paths').innerHTML = TRAINING.map(t => `
      <div class="card path-card"><div class="pc-head"><div class="path-ico" style="background:${t.bg}">${t.icon}</div><div><h4 style="font-size:14.5px;font-weight:600">${t.title}</h4><span class="dim" style="font-size:12px">${t.lessons} ders</span></div></div>
      <div class="bar ${t.pct === 100 ? 'ok' : ''}"><i style="width:${t.pct}%"></i></div>
      <div style="display:flex;justify-content:space-between;align-items:center"><span class="dim" style="font-size:12px">${t.pct === 100 ? '✓ Tamamlandı' : t.pct === 0 ? 'Başlanmadı' : '%' + t.pct + ' tamamlandı'}</span><button class="btn ${t.pct === 0 ? 'primary' : 'outline'} sm">${t.pct === 0 ? 'Başla' : t.pct === 100 ? 'Tekrar et' : 'Devam et'}</button></div></div>`).join('');
    const lessons = [
      { t: 'Prompt nedir? Temel yapı', type: 'Video · 6 dk', done: true },
      { t: 'Rol, bağlam ve talimat verme', type: 'Makale', done: true },
      { t: 'Few-shot örneklerle yönlendirme', type: 'Video · 9 dk', done: true },
      { t: 'Değişkenli şablonlar ve kütüphane', type: 'Makale', done: false },
      { t: 'Bölüm quizi', type: 'Quiz · 8 soru', done: false },
    ];
    $('#training-lessons').innerHTML = lessons.map(l => `<div class="lesson ${l.done ? 'done' : ''}"><div class="l-check">✓</div><div style="flex:1"><div style="font-size:13.5px;font-weight:${l.done ? 500 : 600}">${l.t}</div><div class="l-type">${l.type}</div></div>${l.done ? '<span class="chip ok">Tamamlandı</span>' : '<button class="btn outline sm">Başla</button>'}</div>`).join('');
  }

  /* ---------------- CREDITS ---------------- */
  function renderCreditsStatic() {
    $('#credit-stats').innerHTML = [
      { l: 'Kalan günlük kredi', v: '1.840', s: '/ 3.000', ic: '◍' },
      { l: 'Bugün harcanan', v: '1.160', s: '38 işlem', ic: '↓' },
      { l: 'Bonus cüzdan', v: '500', s: 'süresiz', ic: '✦' },
      { l: 'Bu ay toplam', v: '24.3K', s: 'kredi', ic: '📊' },
    ].map(s => `<div class="card stat"><div class="s-label"><span class="s-ico">${s.ic}</span>${s.l}</div><div class="s-val tnum">${s.v} <span style="font-size:14px;color:var(--text-3)">${s.s}</span></div></div>`).join('');
    $('#credit-ledger').innerHTML = `<thead><tr><th>Zaman</th><th>Tür</th><th>Kaynak</th><th>Model / Çözüm</th><th style="text-align:right">Kredi</th></tr></thead><tbody>${[
      ['14:32', 'Kullanım', 'Sohbet', 'GPT-4o', -48],
      ['14:05', 'Kullanım', 'Operasyonel AI', 'CV Analizi (n8n)', -120],
      ['13:20', 'Kullanım', 'Sohbet', 'Claude Sonnet 4.5', -85],
      ['11:48', 'Kullanım', 'MCP', 'sharepoint-docs', -12],
      ['09:15', 'Bonus', 'Ek kredi', 'Süper Admin onayı', +1000],
      ['00:00', 'Günlük', 'Otomatik yenileme', '—', +3000],
    ].map(r => `<tr><td class="mono dim">${r[0]}</td><td><span class="chip ${r[1] === 'Bonus' || r[1] === 'Günlük' ? 'ok' : ''}">${r[1]}</span></td><td>${r[2]}</td><td>${r[3]}</td><td style="text-align:right;font-weight:600;color:${r[4] < 0 ? 'var(--text)' : 'var(--ok)'}" class="tnum">${r[4] > 0 ? '+' : ''}${r[4]}</td></tr>`).join('')}</tbody>`;
    $('#credit-request').addEventListener('click', () => toast('Talep gönderildi', 'Ek kredi talebin Süper Admin onayına düştü.', 'info'));
  }
  function drawCredits() { barChart($('#credit-chart'), [2100, 1800, 2400, 1600, 2900, 900, 1160], ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Bugün'], getVar('--accent')); }

  /* ---------------- HISTORY ---------------- */
  function renderHistory() {
    const filters = ['Tümü', 'Sohbetler', 'Operasyonel AI', 'Ajan', 'MCP'];
    $('#history-filter').innerHTML = filters.map((f, i) => `<button class="fchip ${i === 0 ? 'active' : ''}">${f}</button>`).join('');
    const rows = [
      ['Bugün 14:32', 'Sohbet', 'Q3 lansman planı taslağı', 'GPT-4o', 48],
      ['Bugün 14:05', 'Operasyonel AI', 'CV Analizi — 12 aday', 'n8n', 120],
      ['Bugün 11:48', 'MCP', 'sharepoint-docs · searchDocs', 'Gateway', 12],
      ['Dün 16:20', 'Ajan', 'İK Asistanı — izin sorgusu', 'Copilot', 15],
      ['Dün 10:03', 'Sohbet', 'Sözleşme risk taraması', 'Claude Sonnet 4.5', 85],
      ['23 Tem', 'Operasyonel AI', 'Dokümandan veri okuma', 'Foundry', 8],
    ];
    $('#history-tbl').innerHTML = `<thead><tr><th>Zaman</th><th>Tür</th><th>Başlık</th><th>Model/Motor</th><th style="text-align:right">Kredi</th><th></th></tr></thead><tbody>${rows.map(r => `<tr><td class="dim">${r[0]}</td><td><span class="chip">${r[1]}</span></td><td class="cell-strong">${r[2]}</td><td>${r[3]}</td><td style="text-align:right" class="tnum muted">${r[4]}</td><td style="text-align:right"><button class="btn ghost sm">Aç</button></td></tr>`).join('')}</tbody>`;
    $('#history-filter').addEventListener('click', e => { const b = e.target.closest('.fchip'); if (!b) return; $$('#history-filter .fchip').forEach(x => x.classList.remove('active')); b.classList.add('active'); });
  }

  /* ---------------- ADMIN ---------------- */
  const ADMIN_TABS = ['Genel Bakış', 'Kullanıcılar', 'Kredi', 'Modeller', 'Çözümler', 'MCP', 'Guardrail', 'Loglar', 'Dış API'];
  function renderAdmin() {
    $('#admin-sub').innerHTML = ADMIN_TABS.map((t, i) => `<button class="admin-tab ${i === 0 ? 'active' : ''}" data-i="${i}">${t}</button>`).join('');
    $('#admin-panes').innerHTML = ADMIN_TABS.map((t, i) => `<div class="admin-pane ${i === 0 ? 'active' : ''}" id="ap-${i}">${adminPane(i)}</div>`).join('');
    $('#admin-sub').addEventListener('click', e => { const b = e.target.closest('.admin-tab'); if (!b) return; $$('.admin-tab').forEach(x => x.classList.remove('active')); b.classList.add('active'); $$('.admin-pane').forEach((p, i) => p.classList.toggle('active', i == b.dataset.i)); if (b.dataset.i == 0) drawAdminCharts(); });
  }
  function tbl(head, rows) { return `<div class="panel"><div class="tbl-wrap"><table class="tbl"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`; }
  function adminPane(i) {
    switch (i) {
      case 0: return `
        <div class="grid g-4">${[
          { l: 'Günlük aktif kullanıcı', v: '1.284', s: '<b>+8%</b> bu hafta', ic: '👥' },
          { l: 'Toplam istek (24s)', v: '18.402', s: '<b>+12%</b>', ic: '📨' },
          { l: 'Kredi tüketimi (24s)', v: '842K', s: '≈ ₺6.740 maliyet', ic: '◍' },
          { l: 'Hata oranı', v: '%0.7', s: '<b class="down">-0.2p</b>', ic: '⚠️' },
        ].map(s => `<div class="card stat"><div class="s-label"><span class="s-ico">${s.ic}</span>${s.l}</div><div class="s-val tnum">${s.v}</div><div class="s-sub">${s.s}</div></div>`).join('')}</div>
        <div class="grid g-2" style="margin-top:16px;grid-template-columns:1.6fr 1fr">
          <div class="panel"><div class="panel-head"><h3>İstek hacmi (7 gün)</h3></div><canvas id="admin-line" width="700" height="220"></canvas></div>
          <div class="panel"><div class="panel-head"><h3>Model dağılımı</h3></div><div style="display:flex;align-items:center;gap:18px"><canvas id="admin-donut" width="180" height="220" style="max-width:180px"></canvas><div id="admin-donut-legend" style="flex:1"></div></div></div>
        </div>`;
      case 1: return tbl(['Kullanıcı', 'Tür', 'Departman', 'Rol', 'Son giriş'], [
        ['Ertekin Öztürgüt', '<span class="chip info">SSO</span>', 'Mühendislik', '<span class="role-pill super">Süper Admin</span>', 'Şimdi'],
        ['Ayşe Demir', '<span class="chip info">SSO</span>', 'İnsan Kaynakları', '<span class="role-pill admin">Admin</span>', '2 saat önce'],
        ['danisman@partner.com', '<span class="chip">Statik</span>', '—', '<span class="role-pill">Kullanıcı</span>', 'Dün'],
        ['Mehmet Kaya', '<span class="chip info">SSO</span>', 'Kalite', '<span class="role-pill">İçerik Editörü</span>', '3 gün önce'],
      ]);
      case 2: return `<div class="grid g-3">${[['Rol/Departman varsayılanları', '6 politika tanımlı'], ['Bekleyen ek kredi talepleri', '<b style="color:var(--accent)">3 talep</b> onay bekliyor'], ['Tüketim anomali uyarısı', '1 kullanıcıda ani artış']].map(c => `<div class="panel"><h3 style="font-size:14px">${c[0]}</h3><p class="muted" style="margin-top:6px;font-size:13px">${c[1]}</p></div>`).join('')}</div>
        <div style="margin-top:16px">${tbl(['Talep eden', 'Departman', 'Kredi', 'Gerekçe', 'İşlem'], [
          ['Ayşe Demir', 'İK', '1.000', 'Toplu CV analizi', '<button class="btn primary sm">Onayla</button> <button class="btn ghost sm">Reddet</button>'],
          ['Can Yıldız', 'Finans', '2.000', 'Çeyrek sonu raporlama', '<button class="btn primary sm">Onayla</button> <button class="btn ghost sm">Reddet</button>'],
        ])}</div>`;
      case 3: return tbl(['Model', 'Sağlayıcı', 'Kredi katsayısı', 'Yetenekler', 'Durum'], MODELS.map(m => [`<b>${m.name}</b>`, 'Azure AI Foundry', m.cost, m.caps.map(c => `<span class="cap-badge">${c}</span>`).join(' '), '<span class="chip ok"><span class="dt"></span>Yayında</span>']));
      case 4: return tbl(['Çözüm', 'Motor (ExecutionTarget)', 'Kredi', 'Yetki grubu', 'Durum'], SOLUTIONS.map(s => [`<b>${s.name}</b>`, `<span class="engine-badge engine-${s.engine}">${s.engine === 'foundry' ? 'Foundry' : 'n8n'}</span>`, s.cost, 'Tüm çalışanlar', '<span class="chip ok"><span class="dt"></span>Aktif']));
      case 5: return tbl(['MCP Sunucusu', 'Versiyon', 'Sağlık', 'Sınıf', 'Aktif key', 'Çağrı (24s)'], MCPS.map(m => [`<b class="mono">${m.name}</b>`, m.ver, `<span class="chip ${m.health === 'ok' ? 'ok' : 'warn'}"><span class="dt"></span>${HEALTH[m.health][1]}</span>`, m.cls, Math.floor(Math.random() * 40 + 5), (Math.floor(Math.random() * 900 + 100)).toLocaleString('tr')]));
      case 6: return `<div class="panel"><div class="panel-head"><h3>Guardrail politikaları</h3><button class="btn outline sm">+ Politika ekle</button></div>${[['PII Maskeleme (TC, IBAN)', 'enforced', 'Tüm modeller'], ['Yasaklı konu filtresi', 'enforced', 'Chat + Çözümler'], ['Marka/hukuk uyarısı', 'önce logla', 'Çıktı katmanı']].map(g => `<div class="lesson"><div style="flex:1"><b style="font-size:13.5px">${g[0]}</b><div class="l-type">${g[2]}</div></div><span class="chip ${g[1] === 'enforced' ? 'red' : 'warn'}">${g[1]}</span></div>`).join('')}</div>`;
      case 7: return `<div style="margin-bottom:12px" class="login-note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>Loglar iki depoda tutulur: kullanıcıya dönük operasyonel depo ve değişmez (append-only) denetim deposu. Her erişim ayrıca loglanır.</div>${tbl(['Zaman', 'Aktör', 'Eylem', 'Hedef', 'IP'], [
        ['14:32:07', 'Ertekin Ö.', 'chat.invoke', 'GPT-4o', '10.4.2.11'],
        ['14:30:55', 'Ayşe D.', 'credit.approve', 'Can Yıldız +2000', '10.4.3.8'],
        ['14:28:12', 'sistem', 'guardrail.block', 'PII tespiti · maskelendi', '—'],
        ['14:20:41', 'danisman@…', 'mcp.proxy', 'sharepoint-docs.searchDocs', '188.2.x.x'],
      ])}`;
      case 8: return `<div class="panel"><div class="panel-head"><h3>Dış API istemcileri</h3><button class="btn primary sm">+ İstemci oluştur</button></div>${tbl(['İstemci', 'Sahip', 'Scope', 'Kota', 'Durum'], [
        ['sap-entegrasyon', 'BT / Entegrasyon', '<span class="mono" style="font-size:11px">chat:invoke, mcp:proxy</span>', '5K istek/gün', '<span class="chip ok"><span class="dt"></span>Aktif</span>'],
        ['ik-portal', 'İK Dijital', '<span class="mono" style="font-size:11px">solutions:cv-analysis</span>', '1K istek/gün', '<span class="chip ok"><span class="dt"></span>Aktif</span>'],
      ])}</div>`;
    }
    return '';
  }
  function drawAdminCharts() {
    if ($('#admin-line')) lineChart($('#admin-line'), [12000, 14500, 13800, 16200, 18400, 9200, 11000], getVar('--accent'));
    if ($('#admin-donut')) {
      const data = [{ n: 'GPT-4o', v: 44, c: '#10a37f' }, { n: 'Claude', v: 26, c: '#d97757' }, { n: 'Llama', v: 16, c: '#4267b2' }, { n: 'Mistral', v: 9, c: '#ff7000' }, { n: 'Phi', v: 5, c: '#0078d4' }];
      donut($('#admin-donut'), data);
      $('#admin-donut-legend').innerHTML = data.map(d => `<div style="display:flex;align-items:center;gap:8px;font-size:12.5px;padding:4px 0"><span style="width:10px;height:10px;border-radius:3px;background:${d.c}"></span><span style="flex:1">${d.n}</span><b>%${d.v}</b></div>`).join('');
    }
  }

  /* ---------------- CHAT ---------------- */
  const CHATS = { 'Bugün': ['Q3 lansman planı taslağı', 'Sözleşme risk taraması', 'Excel formülü yardımı'], 'Dün': ['Toplantı notu özeti', 'E-posta taslağı — tedarikçi'], 'Bu hafta': ['Kod review önerileri', 'KVKK bilgilendirme metni'] };
  const PROMPTS = [{ t: 'Toplantı Özeti Çıkar', d: 'Transkriptten karar ve aksiyon çıkar' }, { t: 'Kurumsal E-posta Taslağı', d: 'Resmi ama sıcak ton' }, { t: 'Sözleşme Risk Taraması', d: 'Riskli maddeleri işaretle' }, { t: 'Metni Sadeleştir', d: 'Daha anlaşılır hale getir' }];
  let curModel = MODELS[0];
  function renderChat() {
    $('#chat-list').innerHTML = Object.entries(CHATS).map(([g, arr]) => `<div class="cs-group">${g}</div>${arr.map((c, i) => `<div class="cs-item ${g === 'Bugün' && i === 0 ? 'active' : ''}">${c}</div>`).join('')}`).join('');
    $('#model-menu').innerHTML = MODELS.map(m => `<div class="model-opt" data-id="${m.id}"><span class="m-logo" style="background:${m.color};width:26px;height:26px;border-radius:6px">${m.logo}</span><div class="mo-meta"><b>${m.name}</b><span>${m.ctx} · ${m.caps.join(', ')}</span></div><span class="mo-cost">${m.cost}</span></div>`).join('');
    $('#palette').innerHTML = PROMPTS.map(p => `<div class="p-item"><b>${p.t}</b><span>${p.d}</span></div>`).join('');
    resetChat();
  }
  const CHAT_SUGGESTIONS = ['Bu metni özetle', 'Bir e-posta taslağı yaz', 'İngilizceye çevir', 'Fikir üret', 'Bir tabloyu açıkla'];
  function resetChat() {
    $('#chat-inner').innerHTML = '';
    addMsg('ai', `<p>Merhaba! Ben T-AI Hub sohbet asistanıyım. Yapay zekaya buradan mesajlaşma gibi soru sorabilirsin — konuşmaların kurumsal olarak korunur.</p><p>Ne yazacağından emin değilsen aşağıdaki hazır önerilerden birine tıkla:</p>`, curModel, 0, 0);
    const sg = el('div', 'suggest');
    sg.innerHTML = CHAT_SUGGESTIONS.map(s => `<button class="sg">${s}</button>`).join('');
    sg.addEventListener('click', e => { const b = e.target.closest('.sg'); if (!b) return; const inp = $('#composer-input'); inp.value = b.textContent + ': '; inp.focus(); inp.dispatchEvent(new Event('input')); });
    $('#chat-inner').appendChild(sg);
  }
  function addMsg(role, html, model, tokens, credit) {
    const meta = role === 'ai' && tokens ? `<div class="m-meta"><span class="mm"><span class="m-logo" style="width:14px;height:14px;border-radius:3px;font-size:8px;background:${model.color}">${model.logo}</span>${model.name}</span><span class="mm">◍ ${credit} kredi</span><span class="mm">${tokens} token</span></div><div class="m-actions"><button>Kopyala</button><button>Yeniden üret</button><button>👍</button><button>👎</button></div>` : '';
    const m = el('div', 'msg ' + role, `<div class="m-av">${role === 'ai' ? 'AI' : 'EÖ'}</div><div class="m-body"><div class="m-role">${role === 'ai' ? model.name : 'Sen'}</div><div class="m-text">${html}</div>${meta}</div>`);
    $('#chat-inner').appendChild(m); $('#chat-scroll').scrollTop = $('#chat-scroll').scrollHeight;
    return m;
  }
  function sendMessage() {
    const inp = $('#composer-input'); const text = inp.value.trim(); if (!text) return;
    addMsg('user', text.replace(/</g, '&lt;')); inp.value = ''; inp.style.height = 'auto'; $('#palette').classList.remove('open');
    const aiMsg = addMsg('ai', '<div class="typing"><i></i><i></i><i></i></div>', curModel);
    const reply = pickReply(text);
    setTimeout(() => {
      const body = aiMsg.querySelector('.m-text'); body.innerHTML = '';
      let i = 0; const words = reply.split(' ');
      const tick = setInterval(() => {
        body.innerHTML = words.slice(0, ++i).join(' ');
        $('#chat-scroll').scrollTop = $('#chat-scroll').scrollHeight;
        if (i >= words.length) {
          clearInterval(tick);
          const tokens = Math.floor(reply.length / 3 + 40), credit = Math.max(4, Math.round(tokens / 25));
          const metaHtml = `<div class="m-meta"><span class="mm"><span class="m-logo" style="width:14px;height:14px;border-radius:3px;font-size:8px;background:${curModel.color}">${curModel.logo}</span>${curModel.name}</span><span class="mm">◍ ${credit} kredi</span><span class="mm">${tokens} token</span></div><div class="m-actions"><button>Kopyala</button><button>Yeniden üret</button><button>👍</button><button>👎</button></div>`;
          aiMsg.querySelector('.m-body').insertAdjacentHTML('beforeend', metaHtml);
        }
      }, 34);
    }, 700);
  }
  function pickReply(t) {
    const s = t.toLowerCase();
    if (s.includes('özet')) return 'Tabii, özet çıkarabilirim. Metni veya dosyayı paylaştığında; ana başlıkları, alınan kararları ve sorumlu bazında aksiyon maddelerini madde madde çıkarırım. Bu yanıt kurumsal olarak loglanır ve guardrail politikalarından geçer.';
    if (s.includes('e-posta') || s.includes('mail')) return 'Kurumsal e-posta taslağı için konuyu, alıcıyı ve istediğin tonu belirtmen yeterli. Resmi ama sıcak bir Toyota kurumsal diliyle taslak hazırlarım; istersen İngilizce versiyonunu da eklerim.';
    if (s.includes('kod') || s.includes('code') || s.includes('formül')) return 'Elbette. Kullandığın dili ve beklenen davranışı yazarsan çalışan bir örnek ve kısa bir açıklama veririm. Kurumsal guardrail nedeniyle gizli sistem adları maskelenebilir.';
    return 'Anladım. Bu bir prototip yanıtıdır — gerçek dağıtımda IModelProvider soyutlaması üzerinden ' + curModel.name + ' modeline gider, yanıt SSE ile akıtılır, kredi düşümü ve loglama tek noktadan (API Gateway) işlenir. Sorunu biraz detaylandırırsan daha somut yardımcı olabilirim.';
  }
  function initChat() {
    const inp = $('#composer-input');
    inp.addEventListener('input', () => { inp.style.height = 'auto'; inp.style.height = Math.min(160, inp.scrollHeight) + 'px'; $('#palette').classList.toggle('open', inp.value.startsWith('/')); });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
    $('#send-btn').addEventListener('click', sendMessage);
    $('#new-chat').addEventListener('click', resetChat);
    $('#palette-btn').addEventListener('click', () => $('#palette').classList.toggle('open'));
    $('#palette').addEventListener('click', e => { const it = e.target.closest('.p-item'); if (!it) return; inp.value = PROMPTS.find(p => p.t === it.querySelector('b').textContent).t + ': '; $('#palette').classList.remove('open'); inp.focus(); inp.dispatchEvent(new Event('input')); });
    $('#model-btn').addEventListener('click', e => { e.stopPropagation(); $('#model-menu').classList.toggle('open'); });
    document.addEventListener('click', e => { if (!e.target.closest('.model-select')) $('#model-menu').classList.remove('open'); });
    $('#model-menu').addEventListener('click', e => { const o = e.target.closest('.model-opt'); if (!o) return; curModel = MODELS.find(m => m.id === o.dataset.id); $('#mb-name').textContent = curModel.name; const lg = $('#mb-logo'); lg.textContent = curModel.logo; lg.style.background = curModel.color; $('#model-menu').classList.remove('open'); toast('Model değişti', curModel.name + ' seçildi.', 'info'); });
    $('#chat-list').addEventListener('click', e => { const it = e.target.closest('.cs-item'); if (!it) return; $$('.cs-item').forEach(x => x.classList.remove('active')); it.classList.add('active'); });
  }

  /* ---------------- TOOLTIP (jargon ipuçları) ---------------- */
  function initTooltips() {
    const tip = $('#tooltip');
    function show(elm) {
      if (!$('#tour').hidden) return;
      const t = elm.getAttribute('data-help'); if (!t) return;
      tip.textContent = t; tip.hidden = false;
      const r = elm.getBoundingClientRect();
      let left = r.left, top = r.bottom + 8;
      if (left + 264 > innerWidth - 12) left = innerWidth - 276;
      if (left < 12) left = 12;
      if (top + tip.offsetHeight > innerHeight - 12) top = r.top - tip.offsetHeight - 8;
      tip.style.left = left + 'px'; tip.style.top = top + 'px';
    }
    const hide = () => tip.hidden = true;
    document.addEventListener('mouseover', e => { const el = e.target.closest('[data-help]'); if (el) show(el); });
    document.addEventListener('mouseout', e => { if (e.target.closest('[data-help]')) hide(); });
    document.addEventListener('focusin', e => { const el = e.target.closest('[data-help]'); if (el) show(el); });
    document.addEventListener('focusout', hide);
    window.addEventListener('scroll', hide, true);
  }

  /* ---------------- HELP POPOVER ---------------- */
  function initHelp() {
    const pop = $('#help-pop');
    $('#help-btn').addEventListener('click', e => { e.stopPropagation(); $('#notif-pop').classList.remove('open'); pop.classList.toggle('open'); });
    document.addEventListener('click', e => { if (!e.target.closest('#help-pop') && !e.target.closest('#help-btn')) pop.classList.remove('open'); });
    $('#tour-start').addEventListener('click', () => { pop.classList.remove('open'); startTour(); });
    $('#text-size').addEventListener('click', e => {
      const b = e.target.closest('.seg-btn'); if (!b) return;
      $$('#text-size .seg-btn').forEach(x => x.classList.remove('active')); b.classList.add('active');
      document.documentElement.setAttribute('data-text', b.dataset.ts);
      setTimeout(() => { redrawRings(); if ($('#v-credits').classList.contains('active')) drawCredits(); if ($('#v-admin').classList.contains('active')) drawAdminCharts(); }, 60);
    });
    $('#rm-toggle').addEventListener('change', e => { document.body.classList.toggle('reduce-motion', e.target.checked); toast('Erişilebilirlik', e.target.checked ? 'Hareket azaltıldı.' : 'Hareket geri açıldı.', 'info'); });
  }

  /* ---------------- TANITIM TURU ---------------- */
  const TOUR_STEPS = [
    { sel: '#side-nav', title: 'Sol menü', text: 'Tüm bölümlere buradan geçersin. Bir bölümün ne işe yaradığını görmek için üzerine gelmen yeterli.' },
    { sel: '.nav-item[data-view="chat"]', title: 'AI Sohbet', text: 'Yapay zekaya mesajlaşma gibi soru sorabilir, metin yazdırabilir, özet çıkartabilirsin. Ne yazacağını bilmesen de hazır öneriler çıkar.' },
    { sel: '.nav-item[data-view="solutions"]', title: 'Hazır araçlar', text: 'Operasyonel AI\'da tek tıkla çalışan araçlar var: dosya oku, sesi yazıya çevir, çeviri yap — form doldur, çalıştır, bitti.' },
    { sel: '#credit-pill', title: 'Kredin', text: 'Bu, kalan kullanım hakkını gösterir. Her işlem biraz kredi harcar; her gece yeniden dolar.' },
    { sel: '#help-btn', title: 'Yardım hep burada', text: 'Takıldığında bu turu tekrar başlatabilir, terimlerin anlamına bakabilir ve yazıyı büyütebilirsin.' },
  ];
  let tourIdx = 0;
  function tourDone(v) { try { return v === undefined ? localStorage.getItem('taihub_tour') === '1' : localStorage.setItem('taihub_tour', '1'); } catch (e) { return false; } }
  function startTour() { tourIdx = 0; $('#tour').hidden = false; $('#tooltip').hidden = true; showTourStep(); }
  function endTour() { $('#tour').hidden = true; tourDone(1); }
  function showTourStep() {
    const st = TOUR_STEPS[tourIdx]; const elm = $(st.sel); if (!elm) { endTour(); return; }
    elm.scrollIntoView({ block: 'nearest' });
    const r = elm.getBoundingClientRect(), pad = 8, ring = $('#tour-ring');
    ring.style.left = (r.left - pad) + 'px'; ring.style.top = (r.top - pad) + 'px';
    ring.style.width = (r.width + pad * 2) + 'px'; ring.style.height = (r.height + pad * 2) + 'px';
    $('#tp-step').textContent = `Adım ${tourIdx + 1} / ${TOUR_STEPS.length}`;
    $('#tp-title').textContent = st.title; $('#tp-text').textContent = st.text;
    $('#tp-prev').style.visibility = tourIdx === 0 ? 'hidden' : 'visible';
    $('#tp-next').textContent = tourIdx === TOUR_STEPS.length - 1 ? 'Bitir' : 'İleri';
    const pop = $('#tp-pop') || $('#tour-pop'); const pw = 306, ph = pop.offsetHeight || 170;
    let left = r.right + 16, top = r.top;
    if (left + pw > innerWidth - 12) { left = r.left; top = r.bottom + 16; }
    if (left + pw > innerWidth - 12) left = innerWidth - pw - 12;
    if (left < 12) left = 12;
    if (top + ph > innerHeight - 12) top = Math.max(12, innerHeight - ph - 12);
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
  }
  function initTour() {
    $('#tp-next').addEventListener('click', () => { if (tourIdx >= TOUR_STEPS.length - 1) { endTour(); toast('Hazırsın! 🎉', 'İstediğin zaman sağ üstteki ? ile tekrar bakabilirsin.', 'ok'); } else { tourIdx++; showTourStep(); } });
    $('#tp-prev').addEventListener('click', () => { if (tourIdx > 0) { tourIdx--; showTourStep(); } });
    $('#tp-skip').addEventListener('click', endTour);
    window.addEventListener('resize', () => { if (!$('#tour').hidden) showTourStep(); });
  }
  function maybeStartTour() { if (tourDone()) return; setTimeout(() => { if (!$('#app').classList.contains('hidden')) startTour(); }, 750); }

  /* ---------------- İLK ADIMLAR REHBERİ ---------------- */
  const OSTEPS = [
    { t: 'Hesabını bağladın', d: 'Kurumsal giriş tamam', done: true, go: null },
    { t: 'İlk sohbetini başlat', d: 'AI Sohbet\'i dene', done: false, go: 'chat' },
    { t: 'Bir araç çalıştır', d: 'Operasyonel AI', done: false, go: 'solutions' },
    { t: 'Eğitime göz at', d: '"Platform 101"', done: false, go: 'training' },
  ];
  function renderOnboard() {
    const box = $('#onboard-steps'); if (!box) return;
    box.innerHTML = OSTEPS.map((s, i) => `<button class="step ${s.done ? 'done' : ''}" data-i="${i}"><span class="st-check">✓</span><span><span class="st-t">${s.t}</span><span class="st-d">${s.d}</span></span></button>`).join('');
    const done = OSTEPS.filter(s => s.done).length;
    $('#onboard-bar').style.width = (done / OSTEPS.length * 100) + '%';
    $('#onboard-count').textContent = `${done}/${OSTEPS.length} adım tamamlandı`;
    box.querySelectorAll('.step').forEach(b => b.addEventListener('click', () => { const s = OSTEPS[b.dataset.i]; if (s.go) { s.done = true; renderOnboard(); goto(s.go); } }));
  }
  $('#onboard-dismiss') && $('#onboard-dismiss').addEventListener('click', () => { $('#onboard').style.display = 'none'; });

  /* ---------------- INIT ---------------- */
  renderDashboard(); renderShowcase(); renderAgents(); renderLibraries(); renderSolutions();
  renderMcp(); renderTraining(); renderCreditsStatic(); renderHistory(); renderAdmin();
  renderChat(); initChat();
  initStars(); initTooltips(); initHelp(); initTour(); renderOnboard();
  redrawRings();
  window.addEventListener('resize', () => { redrawRings(); if ($('#v-credits').classList.contains('active')) drawCredits(); if ($('#v-admin').classList.contains('active')) drawAdminCharts(); });
})();
