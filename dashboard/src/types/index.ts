// Mirrors the backend's Drizzle types. Keep in sync manually.

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export type SourceType = 'youtube' | 'upload';
export type MatchStatus =
  | 'pending'
  | 'queued'
  | 'downloading'
  | 'processing'
  | 'completed'
  | 'failed';

export interface Match {
  id: string;
  userId: string;
  title: string;
  sourceType: SourceType;
  sourceUrl: string | null;
  videoPath: string | null;
  status: MatchStatus;
  durationSeconds: string | null; // numeric → string in postgres-js
  createdAt: string;
}

export type EventType = 'pass' | 'shot' | 'sprint' | 'possession';

export interface MatchEvent {
  id: string;
  matchId: string;
  frameNumber: number;
  timestampSeconds: string;
  eventType: EventType;
  playerTrackId: number | null;
  positionX: string | null;
  positionY: string | null;
  metadata: Record<string, unknown> | null;
}

export interface MatchPlayer {
  id: string;
  matchId: string;
  trackId: number;
  team: string | null;
  jerseyNumber: number | null;
  totalDistanceMeters: string;
  totalSprints: number;
  totalPasses: number;
}

export type ReportType = 'single_match' | 'multi_match' | 'opponent';

export interface Report {
  id: string;
  matchId: string;
  type: ReportType;
  pdfPath: string | null;
  insights: Record<string, unknown> | null;
  createdAt: string;
}

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface Job {
  id: string;
  matchId: string;
  type: string;
  status: JobStatus;
  progressPct: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

// API request/response shapes
export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface CreateMatchRequest {
  title: string;
  sourceType: SourceType;
  sourceUrl?: string;
}
