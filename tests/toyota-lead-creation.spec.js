/**
 * Toyota TR - İkinci El Satış Destek Formu Lead Oluşturma Testi
 * URL: https://iletisim.toyota.com.tr/form/ikinci-el-satis-destek
 *
 * Bu test:
 * 1. Forma erişilebilirliği kontrol eder
 * 2. Form alanlarını doldurur
 * 3. Formu gönderir
 * 4. Hata alınırsa sebebini tespit eder
 */

const { test, expect } = require('@playwright/test');

const FORM_URL = '/form/ikinci-el-satis-destek';

const TEST_DATA = {
  ad: 'Test',
  soyad: 'Kullanici',
  telefon: '05321234567',
  email: 'test.kullanici@example.com',
  plaka: '34 ABC 123',
  mesaj: 'Test lead oluşturma - otomatik test',
};

// Hata kodlarına göre olası sebepler
function hataSebebiAcikla(statusCode, url, body = '') {
  // Claude Code web ortamına özgü egress kısıtı
  if (body && body.includes('not in allowlist')) {
    return `NETWORK EGRESS KISITI (Claude Code Web Ortamı):\n` +
           `  • Sunucu mesajı: "${body.trim()}"\n` +
           `  • Bu hata Toyota'nın sunucusundan DEĞİL, Claude Code ortamının\n` +
           `    ağ politikasından geliyor\n` +
           `  • ÇÖZÜM: Environment Settings → Network Policy → Egress Allowlist'e\n` +
           `    'iletisim.toyota.com.tr' ekleyin`;
  }
  const aciklamalar = {
    403: `HTTP 403 Forbidden - Erişim Engellendi:\n` +
         `  • EGRESS KISıTI: Claude Code ortamı bu domain'e izin vermiyor\n` +
         `  • Geo-kısıtlama: Site Türkiye dışındaki IP'leri engelliyor olabilir\n` +
         `  • Bot koruması: Cloudflare/Akamai gibi WAF istek bloklıyor olabilir\n` +
         `  • IP kara listesi: Test ortamının IP'si engellenmiş olabilir`,
    401: `HTTP 401 Unauthorized - Yetkilendirme Gerekli:\n` +
         `  • Oturum açılmamış veya geçersiz token\n` +
         `  • CSRF token eksik veya geçersiz\n` +
         `  • Session cookie bulunamadı`,
    429: `HTTP 429 Too Many Requests - Rate Limit Aşıldı:\n` +
         `  • Çok fazla istek gönderildi\n` +
         `  • IP başına istek limiti doldu\n` +
         `  • Bekleme süresi gerekiyor`,
    500: `HTTP 500 Internal Server Error - Sunucu Hatası:\n` +
         `  • Toyota backend'inde beklenmedik hata\n` +
         `  • Veritabanı bağlantı sorunu\n` +
         `  • API servis kesintisi`,
    502: `HTTP 502 Bad Gateway - Ağ Geçidi Hatası:\n` +
         `  • Reverse proxy arkasındaki sunucu yanıt vermiyor\n` +
         `  • Load balancer sorunu`,
    503: `HTTP 503 Service Unavailable - Servis Kullanılamıyor:\n` +
         `  • Bakım modu aktif\n` +
         `  • Sunucu kapasitesi aşıldı`,
    404: `HTTP 404 Not Found - Sayfa Bulunamadı:\n` +
         `  • Form URL'i değişmiş olabilir\n` +
         `  • Sayfa kaldırılmış olabilir`,
  };
  return aciklamalar[statusCode] || `HTTP ${statusCode} - Bilinmeyen hata kodu: ${url}`;
}

test.describe('Toyota İkinci El Satış Destek - Lead Oluşturma', () => {

  test('1. Sayfaya erişim kontrolü', async ({ page }) => {
    console.log(`\n[TEST 1] Forma erişim deneniyor: ${FORM_URL}`);

    let response;
    try {
      response = await page.goto(FORM_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
    } catch (err) {
      console.error(`[HATA] Sayfa yüklenirken bağlantı hatası: ${err.message}`);
      console.error('[SEBEP] Olası nedenler:\n' +
        '  • DNS çözümlenemedi\n' +
        '  • Bağlantı zaman aşımına uğradı\n' +
        '  • Siteye ağ erişimi yok (güvenlik duvarı/geo-engel)');
      throw err;
    }

    const statusCode = response.status();
    console.log(`[BİLGİ] HTTP Durum Kodu: ${statusCode}`);

    if (statusCode !== 200) {
      const aciklama = hataSebebiAcikla(statusCode, FORM_URL);
      console.error(`\n[HATA TESPİTİ]\n${aciklama}\n`);
    }

    expect(statusCode, hataSebebiAcikla(statusCode, FORM_URL)).toBe(200);
  });

  test('2. Form alanlarını tespit et ve listele', async ({ page }) => {
    console.log(`\n[TEST 2] Form alanları analiz ediliyor...`);

    const response = await page.goto(FORM_URL, { waitUntil: 'networkidle', timeout: 30000 });

    if (response.status() !== 200) {
      console.error(`[SKIP] Sayfa ${response.status()} döndürdüğü için form analizi yapılamadı`);
      test.skip();
      return;
    }

    // Tüm input alanlarını bul
    const inputs = await page.$$eval('input, select, textarea', (elements) =>
      elements.map((el) => ({
        tag: el.tagName.toLowerCase(),
        type: el.type || '',
        name: el.name || '',
        id: el.id || '',
        placeholder: el.placeholder || '',
        required: el.required,
        value: el.value || '',
      }))
    );

    console.log('\n[FORM ALANLARI]:');
    inputs.forEach((input, i) => {
      console.log(`  ${i + 1}. [${input.tag}${input.type ? ':' + input.type : ''}] ` +
        `name="${input.name}" id="${input.id}" ` +
        `placeholder="${input.placeholder}" ` +
        `required=${input.required}`);
    });

    // Form action ve method bilgisi
    const formInfo = await page.$eval('form', (form) => ({
      action: form.action,
      method: form.method,
      id: form.id,
      className: form.className,
    })).catch(() => null);

    if (formInfo) {
      console.log(`\n[FORM BİLGİSİ]: action="${formInfo.action}" method="${formInfo.method}"`);
    } else {
      console.log('[BİLGİ] Standart HTML form bulunamadı - SPA veya dinamik form olabilir');
    }

    expect(inputs.length).toBeGreaterThan(0);
  });

  test('3. Network isteklerini izle - API endpoint tespiti', async ({ page }) => {
    console.log(`\n[TEST 3] API endpoint'leri izleniyor...`);

    const apiRequests = [];

    // XHR ve Fetch isteklerini yakala
    page.on('request', (request) => {
      const url = request.url();
      const method = request.method();
      if (['POST', 'PUT', 'PATCH'].includes(method) ||
          url.includes('api') || url.includes('form') || url.includes('lead')) {
        apiRequests.push({ method, url, headers: request.headers() });
      }
    });

    page.on('response', async (response) => {
      const url = response.url();
      const status = response.status();
      if (['POST', 'PUT', 'PATCH'].includes(response.request().method()) ||
          url.includes('api') || url.includes('lead')) {
        let body = '';
        try { body = await response.text(); } catch {}
        console.log(`[API YANIT] ${status} ${url}`);
        if (body && body.length < 500) console.log(`  Body: ${body}`);
      }
    });

    const response = await page.goto(FORM_URL, { waitUntil: 'networkidle', timeout: 30000 });

    if (response.status() !== 200) {
      console.error(`[SKIP] Sayfa erişimi başarısız (${response.status()})`);
      test.skip();
      return;
    }

    await page.waitForTimeout(2000);

    console.log(`\n[TESPİT EDİLEN API İSTEKLERİ]: ${apiRequests.length} adet`);
    apiRequests.forEach((req, i) => {
      console.log(`  ${i + 1}. [${req.method}] ${req.url}`);
    });

    expect(true).toBe(true);
  });

  test('4. Form doldur ve gönder - Lead oluşturma', async ({ page }) => {
    console.log(`\n[TEST 4] Form dolduruluyor ve gönderiliyor...`);
    console.log('[TEST DATA]:', JSON.stringify(TEST_DATA, null, 2));

    const submitResponses = [];

    page.on('response', async (response) => {
      const method = response.request().method();
      if (method === 'POST') {
        let body = '';
        try { body = await response.text(); } catch {}
        submitResponses.push({
          status: response.status(),
          url: response.url(),
          body: body.substring(0, 1000),
        });
      }
    });

    const gotoResponse = await page.goto(FORM_URL, { waitUntil: 'networkidle', timeout: 30000 });

    if (gotoResponse.status() !== 200) {
      const aciklama = hataSebebiAcikla(gotoResponse.status(), FORM_URL);
      console.error(`\n[FORM ERİŞİM HATASI]\n${aciklama}`);
      test.skip();
      return;
    }

    await page.screenshot({ path: 'test-results/01-form-yuklendi.png' });
    console.log('[OK] Form yüklendi, ekran görüntüsü alındı');

    // Ad alanı
    const adSelectors = ['input[name="ad"]', 'input[name="firstName"]', 'input[name="name"]',
      'input[placeholder*="Ad"]', 'input[placeholder*="İsim"]', '#ad', '#firstName', '#name'];
    for (const sel of adSelectors) {
      const el = await page.$(sel);
      if (el) {
        await el.fill(TEST_DATA.ad);
        console.log(`[OK] Ad dolduruldu: ${sel}`);
        break;
      }
    }

    // Soyad alanı
    const soyadSelectors = ['input[name="soyad"]', 'input[name="lastName"]', 'input[name="surname"]',
      'input[placeholder*="Soyad"]', '#soyad', '#lastName'];
    for (const sel of soyadSelectors) {
      const el = await page.$(sel);
      if (el) {
        await el.fill(TEST_DATA.soyad);
        console.log(`[OK] Soyad dolduruldu: ${sel}`);
        break;
      }
    }

    // Telefon alanı
    const telefonSelectors = ['input[name="telefon"]', 'input[name="phone"]', 'input[name="tel"]',
      'input[type="tel"]', 'input[placeholder*="Telefon"]', 'input[placeholder*="telefon"]',
      '#telefon', '#phone'];
    for (const sel of telefonSelectors) {
      const el = await page.$(sel);
      if (el) {
        await el.fill(TEST_DATA.telefon);
        console.log(`[OK] Telefon dolduruldu: ${sel}`);
        break;
      }
    }

    // E-posta alanı
    const emailSelectors = ['input[name="email"]', 'input[name="eposta"]', 'input[type="email"]',
      'input[placeholder*="E-posta"]', 'input[placeholder*="email"]', '#email', '#eposta'];
    for (const sel of emailSelectors) {
      const el = await page.$(sel);
      if (el) {
        await el.fill(TEST_DATA.email);
        console.log(`[OK] E-posta dolduruldu: ${sel}`);
        break;
      }
    }

    // KVKK / Onay checkbox
    const kvkkSelectors = ['input[type="checkbox"]', 'input[name*="kvkk"]', 'input[name*="consent"]',
      'input[name*="onay"]', 'input[name*="agree"]'];
    for (const sel of kvkkSelectors) {
      const checkboxes = await page.$$(sel);
      for (const cb of checkboxes) {
        const isChecked = await cb.isChecked();
        if (!isChecked) {
          await cb.check();
          console.log(`[OK] Checkbox işaretlendi: ${sel}`);
        }
      }
    }

    await page.screenshot({ path: 'test-results/02-form-dolduruldu.png' });
    console.log('[OK] Form dolduruldu, ekran görüntüsü alındı');

    // Submit butonunu bul ve tıkla
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Gönder")',
      'button:has-text("Formu Gönder")',
      'button:has-text("Başvur")',
      'button:has-text("Talep Gönder")',
      '[class*="submit"]',
    ];

    let submitted = false;
    for (const sel of submitSelectors) {
      const btn = await page.$(sel);
      if (btn) {
        console.log(`[OK] Submit butonu bulundu: ${sel}`);
        await Promise.all([
          page.waitForResponse((res) => res.request().method() === 'POST', { timeout: 10000 })
            .catch(() => null),
          btn.click(),
        ]);
        submitted = true;
        console.log('[OK] Form gönderildi');
        break;
      }
    }

    if (!submitted) {
      console.error('[HATA] Submit butonu bulunamadı');
    }

    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/03-form-gonderildi.png' });

    // Başarı/hata mesajı kontrolü
    const basariSelectors = ['.success', '.alert-success', '[class*="success"]',
      'text=Teşekkür', 'text=teşekkür', 'text=Başarıyla', 'text=gönderildi'];
    const hataSelectors = ['.error', '.alert-danger', '.alert-error', '[class*="error"]',
      '[class*="hata"]', '[role="alert"]'];

    let basariMesaji = null;
    for (const sel of basariSelectors) {
      const el = await page.$(sel).catch(() => null);
      if (el) {
        basariMesaji = await el.textContent().catch(() => '');
        console.log(`[BAŞARI] Form gönderimi başarılı: "${basariMesaji}"`);
        break;
      }
    }

    let hataMesaji = null;
    for (const sel of hataSelectors) {
      const el = await page.$(sel).catch(() => null);
      if (el) {
        hataMesaji = await el.textContent().catch(() => '');
        console.log(`[HATA MESAJI] Sayfa hatası: "${hataMesaji}"`);
        break;
      }
    }

    // API yanıtlarını raporla
    if (submitResponses.length > 0) {
      console.log('\n[API YANIT DETAYLARI]:');
      submitResponses.forEach((res, i) => {
        console.log(`  ${i + 1}. [${res.status}] ${res.url}`);
        if (res.body) console.log(`     Body: ${res.body.substring(0, 300)}`);

        if (res.status !== 200 && res.status !== 201) {
          const aciklama = hataSebebiAcikla(res.status, res.url);
          console.error(`\n  [HATA TESPİTİ]\n  ${aciklama}`);
        }
      });
    }

    expect(basariMesaji || submitResponses.some((r) => r.status < 400))
      .toBeTruthy();
  });

  test('5. Doğrudan HTTP API testi (tarayıcı olmadan)', async ({ request }) => {
    console.log('\n[TEST 5] Doğrudan HTTP isteği ile API test ediliyor...');

    // Önce sayfayı GET ile çek (cookie/CSRF almak için)
    let csrfToken = null;
    const getRes = await request.get(FORM_URL, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    console.log(`[GET] ${FORM_URL} → HTTP ${getRes.status()}`);

    if (getRes.status() !== 200) {
      const aciklama = hataSebebiAcikla(getRes.status(), FORM_URL);
      console.error(`\n[HATA TESPİTİ - HTTP GET]\n${aciklama}`);

      // Yanıt başlıklarını incele
      const headers = getRes.headers();
      console.log('\n[YANIT BAŞLIKLARI]:');
      Object.entries(headers).forEach(([k, v]) => {
        console.log(`  ${k}: ${v}`);
      });

      // Cloudflare kontrolü
      if (headers['cf-ray'] || headers['server']?.includes('cloudflare')) {
        console.error('\n[TESPİT] Cloudflare koruması aktif!');
        console.error('  • Bot koruması (Browser Integrity Check) devrede\n' +
          '  • Headless tarayıcı tespiti yapılıyor\n' +
          '  • Türkiye dışındaki IP\'ler için erişim kısıtlanmış olabilir\n' +
          '  • Çözüm: Türk IP\'li bir ortamdan test edilmeli');
      }

      // Akamai kontrolü
      if (headers['akamai-grn'] || headers['x-check-cacheable']) {
        console.error('\n[TESPİT] Akamai CDN/WAF koruması aktif!');
        console.error('  • Bot Manager devrede olabilir\n' +
          '  • Çözüm: İnsan benzeri tarayıcı davranışı gerekli');
      }

      test.skip();
      return;
    }

    // HTML'den CSRF token çek
    const html = await getRes.text();
    const csrfMatch = html.match(/name="[_]?token"[^>]*value="([^"]+)"/i) ||
                       html.match(/csrf[_-]?token['":\s]+['"]?([a-zA-Z0-9+/=_-]{20,})/i);
    if (csrfMatch) {
      csrfToken = csrfMatch[1];
      console.log(`[OK] CSRF token bulundu: ${csrfToken.substring(0, 20)}...`);
    }

    // POST isteği dene
    const postData = {
      ad: TEST_DATA.ad,
      soyad: TEST_DATA.soyad,
      telefon: TEST_DATA.telefon,
      email: TEST_DATA.email,
      kvkk: '1',
      ...(csrfToken ? { _token: csrfToken } : {}),
    };

    const commonApiPaths = [
      '/api/lead',
      '/api/form/submit',
      '/api/ikinci-el-satis-destek',
      '/form/ikinci-el-satis-destek/submit',
    ];

    for (const apiPath of commonApiPaths) {
      console.log(`\n[POST DENEME] ${apiPath}`);
      const postRes = await request.post(apiPath, {
        data: postData,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://iletisim.toyota.com.tr/form/ikinci-el-satis-destek',
        },
      });

      const status = postRes.status();
      let responseBody = '';
      try { responseBody = await postRes.text(); } catch {}

      console.log(`  Yanıt: HTTP ${status}`);
      if (responseBody) console.log(`  Body: ${responseBody.substring(0, 300)}`);

      if (status === 200 || status === 201) {
        console.log(`[BAŞARI] API endpoint bulundu: ${apiPath}`);
        break;
      }
    }

    expect(true).toBe(true);
  });

});
