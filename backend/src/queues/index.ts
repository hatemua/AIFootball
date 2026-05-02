import { Queue, type ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';

import { config } from '../config.js';

// Single shared Redis connection used by all queues + workers.
// `maxRetriesPerRequest: null` is required by BullMQ.
export const redisConnection = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
});

const connection: ConnectionOptions = redisConnection;

export interface ProcessMatchJobData {
  matchId: string;
  sourceType: 'youtube' | 'upload';
  sourceUrl?: string;
  videoPath?: string;
}

export interface GenerateReportJobData {
  matchId: string;
  reportType: 'single_match' | 'multi_match' | 'opponent';
}

export const processMatchQueue = new Queue<ProcessMatchJobData>('process-match', { connection });
export const generateReportQueue = new Queue<GenerateReportJobData>('generate-report', {
  connection,
});

export const queues = {
  processMatch: processMatchQueue,
  generateReport: generateReportQueue,
};
