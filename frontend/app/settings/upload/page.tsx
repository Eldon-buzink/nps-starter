"use client";
import { useState } from "react";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");

  async function onUpload() {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setStatus("Uploading...");
    const resp = await fetch(process.env.NEXT_PUBLIC_BACKEND_INGEST_URL ?? "/api/ingest", {
      method: "POST", body: fd,
    });
    const json = await resp.json();
    setStatus(JSON.stringify(json, null, 2));
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Upload data</h1>
      <p className="text-sm text-muted-foreground">Upload CSV of XLSX. Alleen admins.</p>
      <input type="file" accept=".csv,.xlsx" onChange={e=>setFile(e.target.files?.[0] ?? null)} />
      <button className="border rounded px-3 py-2" onClick={onUpload}>Upload</button>
      {status && <pre className="p-3 bg-muted rounded text-xs overflow-auto">{status}</pre>}
    </div>
  );
}
