import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useJobs } from "./hooks/use-jobs";
import { JobsSidebar } from "./components/jobs-sidebar";
import { SearchForm } from "./components/search-form";
import { JobStatus } from "./components/job-status";
import { ResultsTable } from "./components/results-table";

export function App() {
  const {
    config,
    jobs,
    currentJobId,
    currentJob,
    columns,
    rows,
    isCreating,
    error,
    createJob,
    selectJob,
    exportCsv,
  } = useJobs();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 lg:static lg:z-auto
          transition-transform duration-200 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <JobsSidebar
          jobs={jobs}
          currentJobId={currentJobId}
          onSelectJob={(id) => {
            selectJob(id);
            setSidebarOpen(false);
          }}
        />
      </div>

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-y-auto">
        {/* Mobile header */}
        <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
          <h1 className="font-heading text-lg font-bold">Lead Machine</h1>
        </div>

        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-6">
          {/* Error banner */}
          {error && (
            <div className="animate-fade-in rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Search form */}
          <SearchForm
            defaultRequest={config?.defaults.request ?? ""}
            defaultCount={config?.defaults.count ?? 250}
            isCreating={isCreating}
            onSubmit={createJob}
          />

          {/* Job status strip */}
          {currentJob && (
            <JobStatus
              job={currentJob}
              rowCount={rows.length || currentJob.rowCount}
              onExport={exportCsv}
            />
          )}

          {/* Results table */}
          <ResultsTable columns={columns} rows={rows} />
        </div>
      </main>
    </div>
  );
}
