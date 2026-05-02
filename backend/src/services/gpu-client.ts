import axios, { type AxiosInstance } from 'axios';

import { config } from '../config.js';

export interface SubmitJobInput {
  matchId: string;
  youtubeUrl?: string;
  videoPath?: string;
  callbackUrl?: string;
}

export interface SubmitJobResponse {
  job_id: string;
  status: string;
}

export interface JobStatusResponse {
  job_id: string;
  match_id: string;
  status: string;
  progress_pct: number;
  error: string | null;
  result: Record<string, unknown> | null;
}

class GpuClient {
  private readonly http: AxiosInstance;

  constructor(baseURL: string) {
    this.http = axios.create({
      baseURL,
      timeout: 30_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async submitJob(input: SubmitJobInput): Promise<SubmitJobResponse> {
    // TODO: handle retries / backoff on transient 5xx
    const { data } = await this.http.post<SubmitJobResponse>('/process', {
      match_id: input.matchId,
      youtube_url: input.youtubeUrl,
      video_path: input.videoPath,
      callback_url: input.callbackUrl,
    });
    return data;
  }

  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    const { data } = await this.http.get<JobStatusResponse>(`/jobs/${jobId}`);
    return data;
  }

  async submitSync(input: SubmitJobInput): Promise<JobStatusResponse> {
    const { data } = await this.http.post<JobStatusResponse>('/process-sync', {
      match_id: input.matchId,
      youtube_url: input.youtubeUrl,
      video_path: input.videoPath,
    });
    return data;
  }

  async health(): Promise<{ status: string; gpu_available: boolean; model_loaded: boolean }> {
    const { data } = await this.http.get('/health');
    return data;
  }
}

export const gpuClient = new GpuClient(config.GPU_SERVER_URL);
