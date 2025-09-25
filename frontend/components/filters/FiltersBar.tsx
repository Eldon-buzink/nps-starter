"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";

export default function FiltersBar({
  surveys, titles,
}: { surveys: string[]; titles: string[] }) {
  const router = useRouter();
  const sp = useSearchParams();

  const [survey, setSurvey] = useState(sp.get("survey") ?? "");
  const [title, setTitle]   = useState(sp.get("title") ?? "");
  const [start, setStart]   = useState(sp.get("start") ?? "");
  const [end, setEnd]       = useState(sp.get("end") ?? "");

  function apply() {
    const q = new URLSearchParams(sp.toString());
    survey ? q.set("survey", survey) : q.delete("survey");
    title  ? q.set("title", title)   : q.delete("title");
    start  ? q.set("start", start)   : q.delete("start");
    end    ? q.set("end", end)       : q.delete("end");
    router.push(`?${q.toString()}`, { scroll: false });
  }

  function reset() {
    router.push("?", { scroll: false });
  }

  return (
    <Card className="mb-4">
      <CardContent className="grid gap-3 md:grid-cols-4 p-4">
        <div>
          <label className="block text-sm mb-1">Survey Type</label>
          <select className="w-full border rounded p-2"
            value={survey} onChange={e=>setSurvey(e.target.value)}>
            <option value="">Alle surveys</option>
            {surveys.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Titel</label>
          <select className="w-full border rounded p-2"
            value={title} onChange={e=>setTitle(e.target.value)}>
            <option value="">Alle titels</option>
            {titles.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Start (YYYY-MM-DD)</label>
          <input className="w-full border rounded p-2" placeholder="2025-01-01"
            value={start} onChange={e=>setStart(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1">Einde (YYYY-MM-DD)</label>
          <input className="w-full border rounded p-2" placeholder="2025-03-31"
            value={end} onChange={e=>setEnd(e.target.value)} />
        </div>
        <div className="md:col-span-4 flex gap-2">
          <Button onClick={apply}>Toepassen</Button>
          <Button variant="ghost" onClick={reset}>Reset</Button>
        </div>
      </CardContent>
    </Card>
  );
}
