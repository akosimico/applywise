export const statuses = ["Applied", "Screening", "Interview", "Offer", "Rejected"] as const;
export type ApplicationStatus = typeof statuses[number];

export interface Application {
  id: string;
  userId: string;
  company: string;
  role: string;
  status: ApplicationStatus;
  dateApplied: string | null;
  jobDescription: string;
  notes: string;
  url: string;
  needsFollowup: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ApplicationInput = Pick<Application, "company" | "role" | "status" | "dateApplied" | "jobDescription" | "notes" | "url">;

