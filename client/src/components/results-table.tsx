import { FileSpreadsheet } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { LeadRow } from "../types";

const COLUMN_LABELS: Record<string, string> = {
  company_name: "Company",
  company_website: "Website",
  employee_count: "Employees",
  contact_name: "Contact",
  contact_title: "Title",
  contact_linkedin: "LinkedIn",
  contact_email: "Email",
  contact_phone: "Phone",
  office_phone: "Office Phone",
  contact_page_url: "Contact Page",
  source_url: "Source",
  source_description: "Description",
  webset_item_id: "Item ID",
};

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isPhone(value: string): boolean {
  return /^[\d\s\-+().]{7,}$/.test(value);
}

function CellValue({ column, value }: { column: string; value: string }) {
  if (!value) return <span className="text-muted-foreground/30">--</span>;

  if (
    isUrl(value) &&
    (column.includes("url") ||
      column.includes("website") ||
      column.includes("linkedin") ||
      column.includes("page"))
  ) {
    const display = value
      .replace(/^https?:\/\/(www\.)?/, "")
      .replace(/\/$/, "");
    return (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="text-emerald-400 hover:text-emerald-300 hover:underline"
        title={value}
      >
        {display.length > 30 ? display.slice(0, 30) + "..." : display}
      </a>
    );
  }

  if (isEmail(value)) {
    return (
      <a
        href={`mailto:${value}`}
        className="text-emerald-400 hover:text-emerald-300 hover:underline"
      >
        {value}
      </a>
    );
  }

  if (isPhone(value) && column.includes("phone")) {
    return (
      <a
        href={`tel:${value.replace(/\s/g, "")}`}
        className="text-emerald-400 hover:text-emerald-300 hover:underline"
      >
        {value}
      </a>
    );
  }

  return <span>{value}</span>;
}

type Props = {
  columns: string[];
  rows: LeadRow[];
};

export function ResultsTable({ columns, rows }: Props) {
  if (rows.length === 0) {
    return (
      <Card className="glass-card animate-fade-in stagger-3">
        <CardContent className="flex flex-col items-center gap-3 py-16">
          <FileSpreadsheet className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            No results yet. Start a search to see leads here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card animate-fade-in stagger-3 overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 font-heading text-lg">
          <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
          Results
          <span className="text-sm font-normal text-muted-foreground">
            ({rows.length} rows)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <ScrollArea className="w-full">
          <div className="min-w-[1200px]">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  {columns.map((col) => (
                    <TableHead
                      key={col}
                      className="whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {COLUMN_LABELS[col] ?? col}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow
                    key={row.webset_item_id || i}
                    className="border-border/30 hover:bg-secondary/30"
                  >
                    {columns.map((col) => (
                      <TableCell
                        key={col}
                        className="max-w-[200px] truncate text-xs"
                      >
                        <CellValue
                          column={col}
                          value={String(
                            row[col as keyof LeadRow] ?? ""
                          )}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
