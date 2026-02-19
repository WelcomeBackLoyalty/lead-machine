import { useEffect, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Download,
  Users,
  Target,
  BrainCircuit,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LeadJobSummary } from "../types";

const statusConfig = {
  pending: {
    icon: Clock,
    label: "Pending",
    color: "text-yellow-400",
    badgeClass: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  },
  running: {
    icon: Loader2,
    label: "Running",
    color: "text-emerald-400",
    badgeClass: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  },
  completed: {
    icon: CheckCircle2,
    label: "Completed",
    color: "text-emerald-300",
    badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  },
  failed: {
    icon: XCircle,
    label: "Failed",
    color: "text-red-400",
    badgeClass: "bg-red-500/20 text-red-400 border-red-500/30",
  },
};

function useElapsedTime(startedAt?: string, completedAt?: string) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    if (!startedAt) {
      setElapsed("");
      return;
    }

    const start = new Date(startedAt).getTime();

    if (completedAt) {
      const end = new Date(completedAt).getTime();
      setElapsed(formatDuration(end - start));
      return;
    }

    const tick = () => {
      setElapsed(formatDuration(Date.now() - start));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt, completedAt]);

  return elapsed;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

type Props = {
  job: LeadJobSummary;
  rowCount: number;
  onExport: () => void;
};

export function JobStatus({ job, rowCount, onExport }: Props) {
  const config = statusConfig[job.status];
  const Icon = config.icon;
  const elapsed = useElapsedTime(job.startedAt, job.completedAt);
  const isRunning = job.status === "running";
  const hasRefinement = !!(job.refinedQuery || job.entity || job.criteria?.length);
  const [showRefinement, setShowRefinement] = useState(false);

  return (
    <Card className="glass-card animate-fade-in stagger-2">
      <CardContent className="flex flex-col gap-3 py-4 px-5">
        <div className="flex flex-wrap items-center gap-4">
          {/* Status badge */}
          <Badge
            variant="outline"
            className={cn("gap-1.5 px-3 py-1 text-sm", config.badgeClass)}
          >
            <Icon
              className={cn("h-3.5 w-3.5", isRunning && "animate-spin")}
            />
            {config.label}
          </Badge>

          {/* Metrics */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>
              <span className="font-medium text-foreground">{rowCount}</span>{" "}
              rows
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Target className="h-3.5 w-3.5" />
            <span>
              Target{" "}
              <span className="font-medium text-foreground">{job.count}</span>
            </span>
          </div>

          {elapsed && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span className={cn(isRunning && "status-pulse")}>
                {elapsed}
              </span>
            </div>
          )}

          {/* AI refinement toggle */}
          {hasRefinement && (
            <button
              type="button"
              onClick={() => setShowRefinement((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <BrainCircuit className="h-3.5 w-3.5" />
              AI Refined
              {showRefinement ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Export button */}
          {job.status === "completed" && rowCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              className="gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          )}

          {/* Error message */}
          {job.error && (
            <p className="w-full text-sm text-red-400">{job.error}</p>
          )}
        </div>

        {/* Refinement details */}
        {hasRefinement && showRefinement && (
          <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm space-y-2">
            {job.entity && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Entity:</span>
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30 text-xs"
                >
                  {job.entity}
                </Badge>
              </div>
            )}
            {job.refinedQuery && (
              <div>
                <span className="text-muted-foreground">Refined query:</span>
                <p className="mt-1 text-foreground/80 leading-relaxed">
                  {job.refinedQuery}
                </p>
              </div>
            )}
            {job.criteria && job.criteria.length > 0 && (
              <div>
                <span className="text-muted-foreground">Criteria:</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {job.criteria.map((c, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="bg-background/50 text-foreground/70 border-border/50 text-xs font-normal"
                    >
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
