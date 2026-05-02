import { sql } from 'drizzle-orm';
import {
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// ─── Enums ───────────────────────────────────────────────────────
export const sourceTypeEnum = pgEnum('source_type', ['youtube', 'upload']);
export const eventTypeEnum = pgEnum('event_type', ['pass', 'shot', 'sprint', 'possession']);
export const reportTypeEnum = pgEnum('report_type', ['single_match', 'multi_match', 'opponent']);
export const matchStatusEnum = pgEnum('match_status', [
  'pending',
  'queued',
  'downloading',
  'processing',
  'completed',
  'failed',
]);
export const jobStatusEnum = pgEnum('job_status', [
  'queued',
  'running',
  'completed',
  'failed',
]);

// ─── Tables ──────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const matches = pgTable('matches', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  sourceType: sourceTypeEnum('source_type').notNull(),
  sourceUrl: text('source_url'),
  videoPath: text('video_path'),
  rawVideoS3Key: text('raw_video_s3_key'),
  annotatedVideoS3Key: text('annotated_video_s3_key'),
  trackingDataS3Key: text('tracking_data_s3_key'),
  eventsDataS3Key: text('events_data_s3_key'),
  reportS3Key: text('report_s3_key'),
  status: matchStatusEnum('status').notNull().default('pending'),
  durationSeconds: numeric('duration_seconds', { precision: 10, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const matchEvents = pgTable('match_events', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  matchId: uuid('match_id')
    .notNull()
    .references(() => matches.id, { onDelete: 'cascade' }),
  frameNumber: integer('frame_number').notNull(),
  timestampSeconds: numeric('timestamp_seconds', { precision: 10, scale: 3 }).notNull(),
  eventType: eventTypeEnum('event_type').notNull(),
  playerTrackId: integer('player_track_id'),
  positionX: numeric('position_x', { precision: 8, scale: 3 }),
  positionY: numeric('position_y', { precision: 8, scale: 3 }),
  metadata: jsonb('metadata'),
});

export const matchPlayers = pgTable('match_players', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  matchId: uuid('match_id')
    .notNull()
    .references(() => matches.id, { onDelete: 'cascade' }),
  trackId: integer('track_id').notNull(),
  team: text('team'),
  jerseyNumber: integer('jersey_number'),
  totalDistanceMeters: numeric('total_distance_meters', { precision: 10, scale: 2 }).default('0'),
  totalSprints: integer('total_sprints').default(0),
  totalPasses: integer('total_passes').default(0),
});

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  matchId: uuid('match_id')
    .notNull()
    .references(() => matches.id, { onDelete: 'cascade' }),
  type: reportTypeEnum('type').notNull(),
  pdfPath: text('pdf_path'),
  insights: jsonb('insights'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  matchId: uuid('match_id')
    .notNull()
    .references(() => matches.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  status: jobStatusEnum('status').notNull().default('queued'),
  progressPct: integer('progress_pct').notNull().default(0),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

// ─── Inferred types (consumed by services / dashboard) ──────────
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;
export type MatchEvent = typeof matchEvents.$inferSelect;
export type MatchPlayer = typeof matchPlayers.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type Job = typeof jobs.$inferSelect;
