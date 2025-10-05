export const THEME_TAXONOMY = [
  "pricing",
  "bezorging",
  "content_kwaliteit",
  "klantenservice",
  "app_ux",
  "aboflexibiliteit",
  "merkvertrouwen",
  "overige",
] as const;

export type Theme = typeof THEME_TAXONOMY[number];

export const CLASSIFY_SYSTEM_NL = `
Je bent een NL-analist voor NPS-feedback van nieuws/magazine abonnementen.
Label Nederlandse opmerkingen volgens vaste thema's en geef sentiment.
Antwoord uitsluitend met geldige JSON, zonder extra tekst.
`.trim();

export const CLASSIFY_USER_TEMPLATE_NL = (args: {
  survey_type: string | null;
  nps_score: number | null;
  title: string | null;
  comment: string;
}) => `
Context:
- SurveyType: ${args.survey_type ?? "-"}
- NPS: ${args.nps_score ?? "-"}
- Titel: ${args.title ?? "-"}
- Opmerking: """${args.comment}"""

Taxonomie (kies uitsluitend uit deze labels):
- ${THEME_TAXONOMY.join(", ")}

JSON schema (exact):
{
  "themes": ["<label>", ...],
  "theme_scores": {"<label>": <0..1>, ...},
  "sentiment": <float between -1 and 1 or null>,
  "keywords": ["...", "..."],
  "language": "nl"
}

Regels:
- Bij lege/n.v.t.-opmerking: themes=["overige"], sentiment=null, keywords=[].
- Houd het beknopt en valide.
`.trim();
