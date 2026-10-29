"use client";
import { useEffect, useState } from "react";
import { api, getStoredKey, KEY_STORAGE } from "@/lib/client";

export default function SettingsPage() {
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [serverKey, setServerKey] = useState<boolean | null>(null);

  useEffect(() => {
    setKey(getStoredKey());
    api<{ server_key: boolean }>("/api/stats").then((r) => setServerKey(r.server_key)).catch(() => {});
  }, []);

  function save() {
    try {
      if (key.trim()) localStorage.setItem(KEY_STORAGE, key.trim());
      else localStorage.removeItem(KEY_STORAGE);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Ayarlar</h1>
      <div className="card space-y-3 p-5">
        <div className="font-medium">Claude API anahtarı</div>
        <p className="text-sm text-mute">
          {serverKey === null
            ? "Kontrol ediliyor…"
            : serverKey
              ? "Sunucuda ANTHROPIC_API_KEY tanımlı; buraya anahtar girmeniz gerekmez."
              : "Sunucuda ANTHROPIC_API_KEY tanımlı değil. Analiz ve sohbet için anahtarınızı buraya girin (yalnızca bu tarayıcıda saklanır ve istek başına sunucuya iletilir)."}
        </p>
        <input className="input font-mono" type="password" placeholder="sk-ant-…" value={key} onChange={(e) => setKey(e.target.value)} />
        <button className="btn-primary" onClick={save}>
          {saved ? "Kaydedildi ✓" : "Kaydet"}
        </button>
      </div>
      <div className="card space-y-2 p-5 text-sm text-mute">
        <div className="font-medium text-ink">Nasıl çalışır?</div>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Yüklenen doküman metne çevrilir ve ~1200 karakterlik örtüşmeli parçalara bölünür.</li>
          <li>Her parça gte-small modeliyle 384 boyutlu vektöre dönüştürülür (pgvector HNSW indeksi) ve tam metin indeksine eklenir.</li>
          <li>Claude her parça grubundan varlıkları ve ilişkileri çıkarır; aynı varlıklar dokümanlar arası birleştirilerek tek bir bilgi grafı oluşur.</li>
          <li>Claude dokümanı özetler, türünü, dilini, anahtar kelimelerini ve önemli noktalarını belirler.</li>
          <li>Sohbette her soru için vektör + tam metin + graf komşuluğu sonuçları RRF ile birleştirilir ve kaynak göstererek yanıtlanır.</li>
        </ol>
      </div>
    </div>
  );
}
