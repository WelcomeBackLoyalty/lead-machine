import {
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Zap,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LeadJobSummary } from "../types";

const statusConfig = {
  pending: { icon: Clock, label: "Pending", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  running: { icon: Loader2, label: "Running", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  completed: { icon: CheckCircle2, label: "Done", className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  failed: { icon: XCircle, label: "Failed", className: "bg-red-500/20 text-red-400 border-red-500/30" },
};

type Props = {
  jobs: LeadJobSummary[];
  currentJobId: string | null;
  onSelectJob: (id: string) => void;
};

export function JobsSidebar({ jobs, currentJobId, onSelectJob }: Props) {
  return (
    <aside className="flex h-screen w-72 flex-col border-r border-border/50 bg-card/50 backdrop-blur-sm">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15">
          <Zap className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="font-heading text-lg font-bold tracking-tight text-foreground">
            Lead Machine
          </h1>
          <p className="text-[11px] text-muted-foreground">
            Powered by Exa
          </p>
        </div>
      </div>

      <Separator className="opacity-50" />

      {/* Job List */}
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Recent Jobs
        </h2>
      </div>

      <ScrollArea className="flex-1 px-3">
        {jobs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Search className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No jobs yet</p>
            <p className="text-xs text-muted-foreground/60">
              Start a search to see jobs here
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 pb-4">
            {jobs.map((job) => {
              const config = statusConfig[job.status];
              const Icon = config.icon;
              const isActive = job.id === currentJobId;
              const isSpinning = job.status === "running";

              return (
                <button
                  key={job.id}
                  onClick={() => onSelectJob(job.id)}
                  className={cn(
                    "group flex w-full flex-col gap-1.5 rounded-lg px-3 py-2.5 text-left transition-all",
                    "hover:bg-secondary/60",
                    isActive && "bg-secondary ring-1 ring-emerald-500/30"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      variant="outline"
                      className={cn("gap-1 text-[10px]", config.className)}
                    >
                      <Icon
                        className={cn(
                          "h-3 w-3",
                          isSpinning && "animate-spin"
                        )}
                      />
                      {config.label}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {job.rowCount}/{job.count}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-xs leading-relaxed text-foreground/80">
                    {job.request}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </aside>
  );
}
