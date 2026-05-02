import { Worker, type Job } from 'bullmq';

import { config } from '../config.js';
import { redisConnection, type ProcessMatchJobData } from '../queues/index.js';
import { gpuClient } from '../services/gpu-client.js';

/**
 * Worker for the `process-match` queue.
 *
 * Flow (TODO — currently just calls the GPU client and returns):
 *   1. Update jobs row to status=running
 *   2. Submit job to GPU server, store remote job_id
 *   3. Poll OR wait for callback webhook to update job state
 *   4. On completion: update match.status, persist events/players
 *   5. On failure: set jobs.error_message, match.status='failed'
 */
export function startProcessMatchWorker(): Worker<ProcessMatchJobData> {
  const worker = new Worker<ProcessMatchJobData>(
    'process-match',
    async (job: Job<ProcessMatchJobData>) => {
      const { matchId, sourceType, sourceUrl, videoPath } = job.data;
      job.log(`Processing match ${matchId} (${sourceType})`);

      // TODO: full pipeline; this is a placeholder shape only.
      const submitted = await gpuClient.submitJob({
        matchId,
        youtubeUrl: sourceType === 'youtube' ? sourceUrl : undefined,
        videoPath: sourceType === 'upload' ? videoPath : undefined,
        callbackUrl: `${config.BACKEND_PUBLIC_URL}/api/webhooks/gpu/job-complete`,
      });

      return { gpuJobId: submitted.job_id };
    },
    { connection: redisConnection, concurrency: 2 },
  );

  worker.on('failed', (job, err) => {
    console.error(`process-match job ${job?.id} failed:`, err);
  });

  return worker;
}
