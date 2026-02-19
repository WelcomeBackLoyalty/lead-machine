import { useCallback, useEffect, useReducer, useRef } from "react";
import type { ApiConfig, LeadJobSummary, LeadRow } from "../types";

type State = {
  config: ApiConfig | null;
  jobs: LeadJobSummary[];
  currentJobId: string | null;
  currentJob: LeadJobSummary | null;
  columns: string[];
  rows: LeadRow[];
  isCreating: boolean;
  error: string | null;
};

type Action =
  | { type: "SET_CONFIG"; config: ApiConfig }
  | { type: "SET_JOBS"; jobs: LeadJobSummary[] }
  | { type: "SET_CURRENT_JOB"; job: LeadJobSummary }
  | { type: "SET_RESULTS"; columns: string[]; rows: LeadRow[] }
  | { type: "SELECT_JOB"; jobId: string }
  | { type: "CLEAR_RESULTS" }
  | { type: "SET_CREATING"; value: boolean }
  | { type: "SET_ERROR"; error: string | null };

const initialState: State = {
  config: null,
  jobs: [],
  currentJobId: null,
  currentJob: null,
  columns: [],
  rows: [],
  isCreating: false,
  error: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_CONFIG":
      return { ...state, config: action.config };
    case "SET_JOBS":
      return {
        ...state,
        jobs: action.jobs,
        currentJob: state.currentJobId
          ? action.jobs.find((j) => j.id === state.currentJobId) ?? state.currentJob
          : state.currentJob,
      };
    case "SET_CURRENT_JOB":
      return { ...state, currentJob: action.job, currentJobId: action.job.id };
    case "SET_RESULTS":
      return { ...state, columns: action.columns, rows: action.rows };
    case "SELECT_JOB":
      return { ...state, currentJobId: action.jobId, columns: [], rows: [] };
    case "CLEAR_RESULTS":
      return { ...state, columns: [], rows: [] };
    case "SET_CREATING":
      return { ...state, isCreating: action.value };
    case "SET_ERROR":
      return { ...state, error: action.error };
    default:
      return state;
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed: ${res.status}`);
  return data as T;
}

export function useJobs() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const loadJobs = useCallback(async () => {
    const data = await fetchJson<{ jobs: LeadJobSummary[] }>("/api/jobs");
    dispatch({ type: "SET_JOBS", jobs: data.jobs });
  }, []);

  const loadResults = useCallback(async (jobId: string) => {
    const data = await fetchJson<{
      columns: string[];
      rows: LeadRow[];
    }>(`/api/jobs/${jobId}/results`);
    dispatch({ type: "SET_RESULTS", columns: data.columns, rows: data.rows });
  }, []);

  const startPolling = useCallback(
    (jobId: string) => {
      stopPolling();

      const poll = async () => {
        try {
          const data = await fetchJson<{ job: LeadJobSummary }>(
            `/api/jobs/${jobId}`
          );
          dispatch({ type: "SET_CURRENT_JOB", job: data.job });

          if (data.job.status === "completed") {
            stopPolling();
            await loadResults(jobId);
            await loadJobs();
            return;
          }

          if (data.job.status === "failed") {
            stopPolling();
            dispatch({
              type: "SET_ERROR",
              error: data.job.error ?? "Job failed",
            });
            await loadJobs();
            return;
          }
        } catch (err) {
          stopPolling();
          dispatch({
            type: "SET_ERROR",
            error: err instanceof Error ? err.message : "Polling error",
          });
        }
      };

      void poll();
      pollRef.current = setInterval(poll, 3000);
    },
    [stopPolling, loadResults, loadJobs]
  );

  const createJob = useCallback(
    async (request: string, count: number, refine = true) => {
      dispatch({ type: "SET_CREATING", value: true });
      dispatch({ type: "SET_ERROR", error: null });
      dispatch({ type: "CLEAR_RESULTS" });

      try {
        const res = await fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request, count, refine }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to create job");

        const job: LeadJobSummary = data.job;
        dispatch({ type: "SET_CURRENT_JOB", job });
        await loadJobs();
        startPolling(job.id);
      } catch (err) {
        dispatch({
          type: "SET_ERROR",
          error: err instanceof Error ? err.message : "Failed to create job",
        });
      } finally {
        dispatch({ type: "SET_CREATING", value: false });
      }
    },
    [loadJobs, startPolling]
  );

  const selectJob = useCallback(
    async (jobId: string) => {
      stopPolling();
      dispatch({ type: "SELECT_JOB", jobId });

      const data = await fetchJson<{ job: LeadJobSummary }>(
        `/api/jobs/${jobId}`
      );
      dispatch({ type: "SET_CURRENT_JOB", job: data.job });

      if (data.job.status === "completed") {
        await loadResults(jobId);
      } else if (
        data.job.status === "pending" ||
        data.job.status === "running"
      ) {
        startPolling(jobId);
      }
    },
    [stopPolling, startPolling, loadResults]
  );

  const exportCsv = useCallback(() => {
    if (!state.currentJobId) return;
    window.location.assign(
      `/api/jobs/${encodeURIComponent(state.currentJobId)}/export.csv`
    );
  }, [state.currentJobId]);

  // Initialize on mount
  useEffect(() => {
    (async () => {
      try {
        const config = await fetchJson<ApiConfig>("/api/config");
        dispatch({ type: "SET_CONFIG", config });
        await loadJobs();
      } catch (err) {
        dispatch({
          type: "SET_ERROR",
          error: err instanceof Error ? err.message : "Failed to initialize",
        });
      }
    })();
    return stopPolling;
  }, [loadJobs, stopPolling]);

  return {
    ...state,
    createJob,
    selectJob,
    exportCsv,
    loadJobs,
  };
}
