export type JobStatus = "pending" | "running" | "completed" | "failed";

export type LeadRow = {
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

export type LeadJobSummary = {
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
};

export type ApiConfig = {
  defaults: {
    request: string;
    count: number;
  };
  csvColumns: string[];
  enrichmentKeys: string[];
};
