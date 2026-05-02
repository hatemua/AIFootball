import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import type { FastifyInstance } from 'fastify';

import { config } from '../config.js';
import { S3_BUCKET, s3Client } from '../services/s3.js';

export async function diagnosticRoutes(app: FastifyInstance): Promise<void> {
  app.get('/diagnostic/s3', async (_request, reply) => {
    try {
      const out = await s3Client.send(
        new ListObjectsV2Command({ Bucket: S3_BUCKET, MaxKeys: 1 }),
      );
      return {
        connected: true,
        bucket: S3_BUCKET,
        region: config.AWS_DEFAULT_REGION,
        fileCount: out.KeyCount ?? 0,
      };
    } catch (err) {
      app.log.error({ err }, 'S3 diagnostic failed');
      return reply.code(503).send({
        connected: false,
        bucket: S3_BUCKET,
        region: config.AWS_DEFAULT_REGION,
        error: (err as Error).message,
      });
    }
  });
}
