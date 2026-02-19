import Anthropic from "@anthropic-ai/sdk";
import cors from "cors";
import dotenv from "dotenv";
import express, { type NextFunction, type Request, type Response } from "express";
import { Exa, CreateEnrichmentParametersFormat, type WebsetEnrichment, type WebsetItem } from "exa-js";
import { Parser as Json2CsvParser } from "json2csv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

type CreateJobBody = {
  request: string;
  count?: number;
  refine?: boolean;
};

type RefinedQuery = {
  query: string;
  entity: "company" | "person" | "custom" | "auto";
  entityDescription?: string;
  criteria: string[];
};

type JobStatus = "pending" | "running" | "completed" | "failed";

type LeadRow = {
  company_name: string;
  company_website: string;
  employee_count: string;
  contact_name: string;
  contact_title: string;
  contact_linkedin: string;
  contact_email: string;
  contact_phone: string;
  office_phone: string;
  contact_page_url: string;
  source_url: string;
  source_description: string;
  webset_item_id: string;
};

type LeadJob = {
  id: string;
  request: string;
  count: number;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  websetId?: string;
  websetTitle?: string;
  refinedQuery?: string;
  entity?: string;
  criteria?: string[];
  rowCount: number;
  rows: LeadRow[];
};

type EnrichmentDefinition = {
  key: keyof LeadRow;
  description: string;
  format: CreateEnrichmentParametersFormat;
};

const app = express();
const port = Number(process.env.PORT ?? 3100);

const jobs = new Map<string, LeadJob>();

const ENRICHMENTS: EnrichmentDefinition[] = [
  {
    key: "contact_name",
    description:
      "Full name of the primary contact, owner, founder, or key decision-maker at this organization.",
    format: CreateEnrichmentParametersFormat.text
  },
  {
    key: "contact_title",
    description:
      "Role or title of that person (e.g. CEO, Owner, Director, Manager).",
    format: CreateEnrichmentParametersFormat.text
  },
  {
    key: "contact_linkedin",
    description: "LinkedIn profile URL for that contact person.",
    format: CreateEnrichmentParametersFormat.url
  },
  {
    key: "contact_email",
    description: "Best public email address for that contact person.",
    format: CreateEnrichmentParametersFormat.email
  },
  {
    key: "contact_phone",
    description: "Best public direct phone number for that contact person.",
    format: CreateEnrichmentParametersFormat.phone
  },
  {
    key: "office_phone",
    description: "Primary public phone number for the organization's main office.",
    format: CreateEnrichmentParametersFormat.phone
  },
  {
    key: "company_website",
    description: "Official website URL for this organization.",
    format: CreateEnrichmentParametersFormat.url
  },
  {
    key: "contact_page_url",
    description: "Direct contact page URL for this organization.",
    format: CreateEnrichmentParametersFormat.url
  },
  {
    key: "employee_count",
    description: "Estimated number of employees at this organization.",
    format: CreateEnrichmentParametersFormat.number
  }
];

const CSV_COLUMNS: (keyof LeadRow)[] = [
  "company_name",
  "company_website",
  "employee_count",
  "contact_name",
  "contact_title",
  "contact_linkedin",
  "contact_email",
  "contact_phone",
  "office_phone",
  "contact_page_url",
  "source_url",
  "source_description",
  "webset_item_id"
];

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/config", (_req: Request, res: Response) => {
  res.json({
    defaults: {
      request: "",
      count: 250
    },
    csvColumns: CSV_COLUMNS,
    enrichmentKeys: ENRICHMENTS.map((item) => item.key)
  });
});

app.get("/api/jobs", route(async (_req: Request, res: Response) => {
  const allJobs = [...jobs.values()]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((job) => summarizeJob(job));

  res.json({ jobs: allJobs });
}));

app.post("/api/jobs", route(async (req: Request<{}, {}, CreateJobBody>, res: Response) => {
    const apiKey = process.env.EXA_API_KEY;
    if (!apiKey) {
      res.status(400).json({
        error:
          "Missing EXA_API_KEY. Add it to your .env file (copy .env.example to .env first)."
      });
      return;
    }

    const requestText = req.body?.request?.trim();
    if (!requestText) {
      res.status(400).json({ error: "A request is required." });
      return;
    }

    const count = clamp(Number(req.body.count ?? 250), 10, 1000);
    const shouldRefine = req.body.refine !== false;
    const createdAt = new Date().toISOString();
    const jobId = createId();

    const refined = shouldRefine
      ? await refineQuery(requestText)
      : { query: requestText, entity: "auto" as const, criteria: [] };

    const job: LeadJob = {
      id: jobId,
      request: requestText,
      count,
      status: "pending",
      createdAt,
      refinedQuery: refined.query !== requestText ? refined.query : undefined,
      entity: refined.entity !== "auto" ? refined.entity : undefined,
      criteria: refined.criteria.length > 0 ? refined.criteria : undefined,
      rowCount: 0,
      rows: []
    };

    jobs.set(jobId, job);

    const searchConfig: Record<string, unknown> = {
      count,
      query: refined.query
    };

    if (refined.entity !== "auto") {
      searchConfig.entity = refined.entity === "custom"
        ? { type: "custom", description: refined.entityDescription ?? "" }
        : { type: refined.entity };
    }

    if (refined.criteria.length > 0) {
      searchConfig.criteria = refined.criteria.map((description) => ({ description }));
    }

    const exa = new Exa(apiKey);
    const webset = await exa.websets.create({
      externalId: `lead-machine-${Date.now()}`,
      search: searchConfig as Parameters<typeof exa.websets.create>[0]["search"],
      enrichments: ENRICHMENTS.map((item) => ({
        description: item.description,
        format: item.format,
        metadata: {
          field: String(item.key)
        }
      }))
    });

    job.websetId = webset.id;
    job.websetTitle = webset.title ?? undefined;
    job.status = "running";
    job.startedAt = new Date().toISOString();

    void runJob(jobId, apiKey);

    res.json({ job: summarizeJob(job) });
}));

app.get("/api/jobs/:id", route(async (req: Request, res: Response) => {
  const job = jobs.get(getParamValue(req.params.id));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  res.json({ job: summarizeJob(job) });
}));

app.get("/api/jobs/:id/results", route(async (req: Request, res: Response) => {
  const job = jobs.get(getParamValue(req.params.id));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  if (job.status !== "completed") {
    res.status(409).json({
      error: "Job is not completed yet.",
      job: summarizeJob(job)
    });
    return;
  }

  res.json({
    job: summarizeJob(job),
    columns: CSV_COLUMNS,
    rows: job.rows
  });
}));

app.get("/api/jobs/:id/export.csv", route(async (req: Request, res: Response) => {
  const job = jobs.get(getParamValue(req.params.id));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  if (job.status !== "completed") {
    res.status(409).json({ error: "Job is not completed yet." });
    return;
  }

  const parser = new Json2CsvParser({ fields: CSV_COLUMNS });
  const csv = parser.parse(job.rows);
  const fileName = `leads-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.send(csv);
}));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "..", "public");

app.use(express.static(publicDir));
app.get(/^\/(?!api).*/, (_req: Request, res: Response) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown server error";
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}:`, error);
  res.status(500).json({ error: message });
});

app.listen(port, () => {
  console.log(`Lead machine running at http://localhost:${port}`);
});

async function refineQuery(rawQuery: string): Promise<RefinedQuery> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return { query: rawQuery, entity: "auto", criteria: [] };
  }

  try {
    const client = new Anthropic({ apiKey: anthropicKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: rawQuery
        }
      ],
      system: `You are a query optimizer for the Exa Websets API, which finds entities (companies, people, etc.) on the web.

Given a user's natural language lead-generation request, decompose it into structured parameters:

1. **query**: Rewrite the request into a specific, descriptive search query (max 5000 chars). Focus on WHAT to find — describe the ideal result. Move hard filters (location, size, industry) to criteria instead.
2. **entity**: Pick the best entity type:
   - "company" — searching for businesses/organizations
   - "person" — searching for individuals
   - "custom" — searching for something else (provide entityDescription)
   - "auto" — if unclear, let Exa auto-detect
3. **entityDescription**: Only required when entity is "custom". Short description of the entity type.
4. **criteria**: 1–5 binary yes/no filter strings. Each criterion MUST be a statement that can be answered true/false about a single result. Examples: "Located in Texas", "Has more than 50 employees", "Is a SaaS company". Move specific filters from the query here. Omit if no clear filters exist.

Respond with ONLY valid JSON matching this schema, no other text:
{"query": string, "entity": "company"|"person"|"custom"|"auto", "entityDescription"?: string, "criteria": string[]}`
    });

    const text = response.content.find((block) => block.type === "text")?.text ?? "";
    const parsed = JSON.parse(text) as RefinedQuery;

    // Validate the response shape
    if (typeof parsed.query !== "string" || !parsed.query.trim()) {
      return { query: rawQuery, entity: "auto", criteria: [] };
    }

    const validEntities = ["company", "person", "custom", "auto"] as const;
    if (!validEntities.includes(parsed.entity)) {
      parsed.entity = "auto";
    }

    if (!Array.isArray(parsed.criteria)) {
      parsed.criteria = [];
    }
    parsed.criteria = parsed.criteria.filter((c) => typeof c === "string" && c.trim()).slice(0, 5);

    return parsed;
  } catch (error) {
    console.error("[refineQuery] Failed, falling back to raw query:", error);
    return { query: rawQuery, entity: "auto", criteria: [] };
  }
}

async function runJob(jobId: string, apiKey: string): Promise<void> {
  const job = jobs.get(jobId);
  if (!job || !job.websetId) {
    return;
  }

  const exa = new Exa(apiKey);

  try {
    await exa.websets.waitUntilIdle(job.websetId, {
      timeout: 20 * 60_000,
      pollInterval: 3000
    });

    const webset = await exa.websets.get(job.websetId);
    const enrichmentFieldMap = buildEnrichmentFieldMap(webset.enrichments ?? []);
    const items = await exa.websets.items.getAll(job.websetId, { limit: 100 });

    const rows = dedupeRows(items.map((item) => buildRowFromItem(item, enrichmentFieldMap)));

    job.rows = rows;
    job.rowCount = rows.length;
    job.status = "completed";
    job.completedAt = new Date().toISOString();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error while running job.";
    job.status = "failed";
    job.error = message;
    job.completedAt = new Date().toISOString();
  }
}

function summarizeJob(job: LeadJob): Omit<LeadJob, "rows"> {
  return {
    id: job.id,
    request: job.request,
    count: job.count,
    status: job.status,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    error: job.error,
    websetId: job.websetId,
    websetTitle: job.websetTitle,
    refinedQuery: job.refinedQuery,
    entity: job.entity,
    criteria: job.criteria,
    rowCount: job.rowCount
  };
}

function buildEnrichmentFieldMap(enrichments: WebsetEnrichment[]): Map<string, keyof LeadRow> {
  const map = new Map<string, keyof LeadRow>();

  for (const enrichment of enrichments) {
    const field = enrichment.metadata?.field;
    if (field && isLeadRowField(field)) {
      map.set(enrichment.id, field);
    }
  }

  return map;
}

function buildRowFromItem(
  item: WebsetItem,
  enrichmentFieldMap: Map<string, keyof LeadRow>
): LeadRow {
  const base = extractBaseFields(item);

  const row: LeadRow = {
    company_name: base.company_name,
    company_website: base.company_website,
    employee_count: base.employee_count,
    contact_name: "",
    contact_title: "",
    contact_linkedin: "",
    contact_email: "",
    contact_phone: "",
    office_phone: "",
    contact_page_url: "",
    source_url: base.source_url,
    source_description: base.source_description,
    webset_item_id: item.id
  };

  for (const enrichmentResult of item.enrichments ?? []) {
    const targetField = enrichmentFieldMap.get(enrichmentResult.enrichmentId);
    if (!targetField) {
      continue;
    }

    const value = normalizeEnrichmentResult(enrichmentResult.result);
    if (!value) {
      continue;
    }

    row[targetField] = value;
  }

  if (!row.company_website) {
    row.company_website = row.source_url;
  }

  return row;
}

function extractBaseFields(item: WebsetItem): {
  company_name: string;
  company_website: string;
  employee_count: string;
  source_url: string;
  source_description: string;
} {
  const properties = item.properties as Record<string, unknown>;
  const type = String(properties.type ?? "");

  if (type === "company") {
    const company = getObject(properties, "company");
    return {
      company_name: stringOrEmpty(company?.name),
      company_website: stringOrEmpty(properties.url),
      employee_count: numberOrEmpty(company?.employees),
      source_url: stringOrEmpty(properties.url),
      source_description: stringOrEmpty(properties.description)
    };
  }

  if (type === "custom") {
    const custom = getObject(properties, "custom");
    return {
      company_name: stringOrEmpty(custom?.title),
      company_website: stringOrEmpty(properties.url),
      employee_count: "",
      source_url: stringOrEmpty(properties.url),
      source_description: stringOrEmpty(properties.description)
    };
  }

  if (type === "person") {
    const person = getObject(properties, "person");
    const company = getObject(person, "company");
    return {
      company_name: stringOrEmpty(company?.name),
      company_website: stringOrEmpty(properties.url),
      employee_count: "",
      source_url: stringOrEmpty(properties.url),
      source_description: stringOrEmpty(properties.description)
    };
  }

  return {
    company_name: "",
    company_website: stringOrEmpty(properties.url),
    employee_count: "",
    source_url: stringOrEmpty(properties.url),
    source_description: stringOrEmpty(properties.description)
  };
}

function normalizeEnrichmentResult(value: string[] | null): string {
  if (!value || !Array.isArray(value)) {
    return "";
  }

  return value.map((item) => item.trim()).filter(Boolean).join(" | ");
}

function dedupeRows(rows: LeadRow[]): LeadRow[] {
  const seen = new Set<string>();
  const deduped: LeadRow[] = [];

  for (const row of rows) {
    const key = [
      normalizeString(row.company_name),
      normalizeString(row.company_website),
      normalizeString(row.contact_name),
      normalizeString(row.contact_email),
      normalizeString(row.contact_phone)
    ].join("|");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(row);
  }

  return deduped;
}

function normalizeString(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function getObject(
  value: Record<string, unknown> | undefined,
  key: string
): Record<string, unknown> | undefined {
  const nested = value?.[key];
  if (!nested || typeof nested !== "object" || Array.isArray(nested)) {
    return undefined;
  }
  return nested as Record<string, unknown>;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberOrEmpty(value: unknown): string {
  return typeof value === "number" ? String(value) : "";
}

function isLeadRowField(value: string): value is keyof LeadRow {
  return CSV_COLUMNS.includes(value as keyof LeadRow);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.round(value)));
}

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function getParamValue(param: string | string[] | undefined): string {
  if (Array.isArray(param)) {
    return param[0] ?? "";
  }
  return param ?? "";
}

function route<TReq extends Request = Request>(
  handler: (req: TReq, res: Response) => Promise<void> | void
) {
  return (req: TReq, res: Response, next: NextFunction): void => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}
