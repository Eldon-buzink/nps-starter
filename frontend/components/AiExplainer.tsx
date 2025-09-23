"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";

export default function AiExplainer({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(!compact);
  return (
    <Card className="mb-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Hoe deze inzichten werken</CardTitle>
        <Button variant="ghost" onClick={() => setOpen(!open)} className="gap-2">
          {open ? "Verberg" : "Toon"} uitleg <ChevronDown className={`h-4 w-4 ${open ? "rotate-180" : ""}`} />
        </Button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3 text-sm leading-6">
          <p>
            We gebruiken AI om elke opmerking automatisch te <b>categoriseren</b> (bijv. prijs, bezorging, inhoud) en een
            <b> sentimentscore</b> te geven. De NPS-score bepaalt of iemand Promoter (9–10), Passive (7–8) of Detractor (0–6) is.
          </p>
          <ul className="list-disc pl-5">
            <li><b>Vaste thema's</b>: pricing, bezorging, content_kwaliteit, klantenservice, app_ux, aboflexibiliteit, merkvertrouwen, overige.</li>
            <li><b>Lege of "n.v.t." opmerkingen</b> slaan we over (geen thema/sentiment).</li>
            <li><b>Taal</b>: Nederlands.</li>
          </ul>
          <p className="text-muted-foreground">
            <b>Waarom?</b> Dit maakt trends zichtbaar (bijv. meer prijs-klachten) en laat zien welke onderwerpen Promoters/Detractors het meest noemen.
          </p>
          <details className="mt-2">
            <summary className="cursor-pointer font-medium">Technische samenvatting (kort)</summary>
            <div className="mt-2 space-y-1">
              <p>• Model: gpt-4o-mini (classificatie), text-embedding-3-large (semantische zoek).</p>
              <p>• Output: JSON met thema's, theme_scores, sentiment (−1..1), keywords.</p>
              <p>• Privacy: we tonen alleen de tekst uit het exportbestand; er worden geen e-mails/adressen gebruikt.</p>
            </div>
          </details>
        </CardContent>
      )}
    </Card>
  );
}
