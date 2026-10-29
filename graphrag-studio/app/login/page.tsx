"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}

function Login() {
  const sp = useSearchParams();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    if (res.ok) window.location.href = sp.get("next") || "/";
    else setErr("Şifre hatalı");
  }
  return (
    <form onSubmit={submit} className="card mx-auto mt-24 max-w-sm space-y-3 p-6">
      <h1 className="text-lg font-semibold">Giriş</h1>
      <input className="input" type="password" autoFocus placeholder="Şifre" value={pw} onChange={(e) => setPw(e.target.value)} />
      {err && <div className="text-sm text-red-300">{err}</div>}
      <button className="btn-primary w-full justify-center">Giriş yap</button>
    </form>
  );
}
