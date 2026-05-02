import { Worker, type Job } from 'bullmq';

import { redisConnection, type GenerateReportJobData } from '../queues/index.js';

/**
 * Worker for the `generate-report` queue.
 *
 * TODO:
 *   1. Load match (+ events / players / opponent comparison data) from DB
 *   2. Build PDF via services/reports.ts
 *   3. Insert reports row with pdf_path + insights
 */
export function startGenerateReportWorker(): Worker<GenerateReportJobData> {
  const worker = new Worker<GenerateReportJobData>(
    'generate-report',
    async (job: Job<GenerateReportJobData>) => {
      job.log(`Generating ${job.data.reportType} report for match ${job.data.matchId}`);
      throw new Error('generate-report worker not implemented yet');
    },
    { connection: redisConnection, concurrency: 1 },
  );

  worker.on('failed', (job, err) => {
    console.error(`generate-report job ${job?.id} failed:`, err);
  });

  return worker;
}
