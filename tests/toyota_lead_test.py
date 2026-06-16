#!/usr/bin/env python3
"""
Toyota TR - İkinci El Satış Destek Formu Lead Oluşturma Testi
URL: https://iletisim.toyota.com.tr/form/ikinci-el-satis-destek

Test akışı:
1. Sayfaya GET isteği at → form yapısı / HTTP durum kodu kontrol
2. Yanıt gövdesini ve başlıklarını incele (egress kısıtı, WAF, geo-block)
3. Form alanlarını parse et
4. POST ile lead göndermeyi dene
5. Her adımda hata varsa sebebini açıkla
"""

import sys
import re
import json
import urllib.request
import urllib.parse
import urllib.error
import http.cookiejar
from html.parser import HTMLParser


FORM_URL = "https://iletisim.toyota.com.tr/form/ikinci-el-satis-destek"

TEST_DATA = {
    "ad": "Test",
    "soyad": "Kullanici",
    "telefon": "05321234567",
    "email": "test.kullanici@example.com",
    "plaka": "34ABC123",
    "mesaj": "Otomatik test - lead oluşturma",
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}

HATA_ACIKLAMALARI = {
    400: {
        "mesaj": "Bad Request - Geçersiz İstek",
        "sebepler": [
            "Form verileri yanlış formatta gönderildi",
            "Zorunlu alanlar eksik (ad, soyad, telefon, email vb.)",
            "Telefon numarası formatı hatalı",
            "E-posta adresi geçersiz",
            "CSRF/token değeri eksik veya hatalı",
        ],
        "cozumler": [
            "Tüm zorunlu alanların dolu olduğunu kontrol et",
            "Content-Type header'ının doğru ayarlandığından emin ol",
            "CSRF token'ı önce GET ile alıp POST'a ekle",
        ],
    },
    401: {
        "mesaj": "Unauthorized - Yetkilendirme Gerekli",
        "sebepler": [
            "Oturum açılmamış veya session süresi dolmuş",
            "Bearer token eksik veya geçersiz",
        ],
        "cozumler": [
            "Önce oturum açma işlemini gerçekleştir",
            "Authorization header'ını kontrol et",
        ],
    },
    403: {
        "mesaj": "Forbidden - Erişim Engellendi",
        "sebepler": [
            "EGRESS KISITI: Claude Code web ortamının ağ politikası bu domain'e izin vermiyor",
            "GEO-KISITLAMA: Site yalnızca Türkiye IP'lerine izin veriyor olabilir",
            "BOT KORUMASI: Cloudflare/Akamai otomatik istek tespiti yapıyor olabilir",
            "IP KARA LİSTESİ: Bu IP adresi engellenmiş olabilir",
            "WAF KURALLARI: Web Application Firewall isteği blokladı",
        ],
        "cozumler": [
            "ÖNCE: claude.ai/code ortamında 'iletisim.toyota.com.tr' domaini egress allowlist'e ekle",
            "VEYA: Testi yerel makinenden ya da Türkiye lokasyonlu bir sunucudan çalıştır",
            "Alternatif: Playwright ile gerçek tarayıcı simülasyonu kullan",
        ],
    },
    404: {
        "mesaj": "Not Found - Sayfa Bulunamadı",
        "sebepler": ["Form URL'i değişmiş", "Sayfa kaldırılmış veya taşınmış"],
        "cozumler": ["Toyota TR iletişim sayfasını kontrol et"],
    },
    429: {
        "mesaj": "Too Many Requests - Rate Limit Aşıldı",
        "sebepler": ["IP başına istek sınırı aşıldı"],
        "cozumler": ["Bir süre bekleyip tekrar dene"],
    },
    500: {
        "mesaj": "Internal Server Error - Sunucu Hatası",
        "sebepler": ["Toyota backend'inde beklenmedik hata"],
        "cozumler": ["Birkaç dakika bekleyip tekrar dene"],
    },
}


class FormParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.inputs = []
        self.forms = []

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == "form":
            self.forms.append({
                "action": attrs_dict.get("action", ""),
                "method": attrs_dict.get("method", "GET"),
                "id": attrs_dict.get("id", ""),
            })
        elif tag in ("input", "select", "textarea"):
            self.inputs.append({
                "tag": tag,
                "type": attrs_dict.get("type", ""),
                "name": attrs_dict.get("name", ""),
                "id": attrs_dict.get("id", ""),
                "placeholder": attrs_dict.get("placeholder", ""),
                "required": "required" in attrs_dict,
            })


def hata_raporu_yazdir(status_code, headers, body=""):
    print(f"\n{'='*60}")
    print(f"HATA TESPİTİ - HTTP {status_code}")
    print("="*60)

    info = HATA_ACIKLAMALARI.get(status_code, {
        "mesaj": f"HTTP {status_code}",
        "sebepler": ["Bilinmeyen durum kodu"],
        "cozumler": [],
    })

    print(f"\nHata: {info['mesaj']}")

    # Egress kısıtı tespiti (Claude Code web ortamına özgü)
    if body and "not in allowlist" in body.lower():
        print("\n*** KRİTİK TESPİT: NETWORK EGRESS KISITI ***")
        print("  Bu hata Toyota'nın sunucusundan DEĞİL,")
        print("  Claude Code web ortamının ağ politikasından geliyor.")
        print(f"\n  Sunucu mesajı: {body.strip()}")
        print("\n  ÇÖZÜM:")
        print("  1. claude.ai/code → Environment Settings")
        print("  2. Network Policy → Egress Allowlist")
        print("  3. 'iletisim.toyota.com.tr' ekle")
        print("  4. Testi tekrar çalıştır")
        return

    print("\nOlası Sebepler:")
    for i, sebep in enumerate(info["sebepler"], 1):
        print(f"  {i}. {sebep}")

    # WAF/CDN tespiti
    server = headers.get("server", "")
    if headers.get("cf-ray") or "cloudflare" in server.lower():
        print("\n  ⚠️  CLOUDFLARE aktif - bot koruması devrede")
    if headers.get("akamai-grn") or "akamai" in server.lower():
        print("  ⚠️  AKAMAI CDN/WAF aktif")

    geo = headers.get("x-geo-country", headers.get("cf-ipcountry", ""))
    if geo and geo.upper() != "TR":
        print(f"\n  ⚠️  GEO-KISITLAMA: Tespit edilen ülke = {geo} (TR bekleniyor)")

    print("\nÖnerilen Çözümler:")
    for i, cozum in enumerate(info["cozumler"], 1):
        print(f"  {i}. {cozum}")

    if body:
        print(f"\nSunucu Yanıtı: {body[:500]}")


def test_1_get_request():
    print("\n" + "="*60)
    print("TEST 1: Sayfaya GET İsteği")
    print("="*60)
    print(f"URL: {FORM_URL}")

    cookie_jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar))
    req = urllib.request.Request(FORM_URL, headers=HEADERS)

    try:
        response = opener.open(req, timeout=30)
        status = response.status
        headers = dict(response.headers)
        body = response.read().decode("utf-8", errors="replace")

        print(f"\n✓ HTTP {status} OK")
        print(f"  Server: {headers.get('server', 'N/A')}")
        cookies = {c.name: c.value for c in cookie_jar}
        if cookies:
            print(f"  Cookie'ler: {list(cookies.keys())}")

        return status, headers, body, cookies

    except urllib.error.HTTPError as e:
        status = e.code
        headers = dict(e.headers)
        try:
            body = e.read().decode("utf-8", errors="replace")
        except Exception:
            body = ""
        print(f"\n✗ HTTP {status}")
        hata_raporu_yazdir(status, headers, body)
        return status, headers, body, {}

    except urllib.error.URLError as e:
        reason = str(e.reason)
        print(f"\n✗ Bağlantı Hatası: {reason}")
        if "timed out" in reason.lower():
            print("  → Zaman aşımı (sunucu yanıt vermiyor)")
        elif "name or service not known" in reason.lower():
            print("  → DNS çözümlenemedi")
        elif "connection refused" in reason.lower():
            print("  → Bağlantı reddedildi")
        return 0, {}, "", {}


def test_2_form_analiz(html_body):
    print("\n" + "="*60)
    print("TEST 2: Form Yapısı Analizi")
    print("="*60)

    if not html_body:
        print("✗ HTML içerik yok")
        return None, []

    parser = FormParser()
    parser.feed(html_body)

    if parser.forms:
        print(f"\nBulunan Form Sayısı: {len(parser.forms)}")
        for i, form in enumerate(parser.forms, 1):
            print(f"  Form {i}: action='{form['action']}' method='{form['method']}'")
    else:
        print("\n✗ Standart HTML form bulunamadı (React/Vue SPA olabilir)")

    if parser.inputs:
        print(f"\nInput Alanları ({len(parser.inputs)} adet):")
        for inp in parser.inputs:
            zorunlu = "ZORUNLU" if inp["required"] else "opsiyonel"
            print(f"  [{zorunlu}] <{inp['tag']}> name='{inp['name']}' "
                  f"placeholder='{inp['placeholder']}'")

    csrf_token = None
    for pattern in [r'name="[_]?token"[^>]*value="([^"]+)"',
                    r'"csrf[_-]?token"[:\s]*"([^"]+)"']:
        match = re.search(pattern, html_body, re.IGNORECASE)
        if match:
            csrf_token = match.group(1)
            print(f"\n✓ CSRF Token: {csrf_token[:30]}...")
            break

    return parser.forms[0] if parser.forms else None, parser.inputs


def test_3_post_lead(cookies, csrf_token=None):
    print("\n" + "="*60)
    print("TEST 3: POST İsteği - Lead Oluşturma")
    print("="*60)

    post_data = {**TEST_DATA, "kvkk": "1", "onay": "1"}
    if csrf_token:
        post_data["_token"] = csrf_token

    encoded = urllib.parse.urlencode(post_data).encode("utf-8")
    headers = {
        **HEADERS,
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer": FORM_URL,
        "Origin": "https://iletisim.toyota.com.tr",
        "X-Requested-With": "XMLHttpRequest",
    }
    if cookies:
        headers["Cookie"] = "; ".join(f"{k}={v}" for k, v in cookies.items())

    req = urllib.request.Request(FORM_URL, data=encoded, headers=headers, method="POST")
    print(f"\nPOST → {FORM_URL}")

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            print(f"✓ HTTP {resp.status}")
            if any(w in body.lower() for w in ["teşekkür", "thank", "başarı", "success"]):
                print("🎉 BAŞARILI: Lead oluşturuldu!")
            else:
                print(f"Yanıt: {body[:300]}")

    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8", errors="replace")
        except Exception:
            pass
        print(f"✗ HTTP {e.code}")
        hata_raporu_yazdir(e.code, dict(e.headers), body)

    except urllib.error.URLError as e:
        print(f"✗ Bağlantı hatası: {e.reason}")


def main():
    print("\n" + "="*60)
    print("TOYOTA TR - İKİNCİ EL SATIŞ DESTEK FORMU")
    print("LEAD OLUŞTURMA TESTİ")
    print("="*60)
    print(f"URL: {FORM_URL}")

    status, headers, body, cookies = test_1_get_request()

    if status == 0:
        print("\n[SONUÇ] Ağ bağlantısı kurulamadı")
        sys.exit(1)

    if status != 200:
        print(f"\n[SONUÇ] Sayfa erişimi başarısız (HTTP {status})")
        if body and "not in allowlist" in body.lower():
            print("\n→ SEBEP: Claude Code web ortamı ağ politikası bu domain'i engelliyor")
            print("→ ÇÖZÜM: Environment ayarlarından 'iletisim.toyota.com.tr' egress'e ekle")
        else:
            print("→ Testi Türkiye IP'li yerel ortamdan çalıştır")
        sys.exit(1)

    csrf_token = None
    form_info, inputs = test_2_form_analiz(body)
    for pattern in [r'name="[_]?token"[^>]*value="([^"]+)"',
                    r'"csrf[_-]?token"[:\s]*"([^"]+)"']:
        m = re.search(pattern, body, re.IGNORECASE)
        if m:
            csrf_token = m.group(1)
            break

    test_3_post_lead(cookies, csrf_token)

    print("\n" + "="*60)
    print("TEST TAMAMLANDI")
    print("="*60)


if __name__ == "__main__":
    main()
