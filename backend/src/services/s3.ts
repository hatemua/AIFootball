import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { config } from '../config.js';

export const s3Client = new S3Client({
  region: config.AWS_DEFAULT_REGION,
  credentials: {
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  },
});

export const S3_BUCKET = config.S3_BUCKET;

export const s3Service = {
  async getSignedDownloadUrl(s3Key: string, expiresIn = 3600): Promise<string> {
    return getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: S3_BUCKET, Key: s3Key }),
      { expiresIn },
    );
  },

  async getSignedUploadUrl(
    s3Key: string,
    contentType: string,
    expiresIn = 3600,
  ): Promise<string> {
    return getSignedUrl(
      s3Client,
      new PutObjectCommand({ Bucket: S3_BUCKET, Key: s3Key, ContentType: contentType }),
      { expiresIn },
    );
  },

  async fileExists(s3Key: string): Promise<boolean> {
    try {
      await s3Client.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: s3Key }));
      return true;
    } catch (err) {
      const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (e?.name === 'NotFound' || e?.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw err;
    }
  },

  async deleteFile(s3Key: string): Promise<void> {
    await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: s3Key }));
  },

  async listFiles(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;
    do {
      const out = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: S3_BUCKET,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );
      for (const obj of out.Contents ?? []) {
        if (obj.Key) keys.push(obj.Key);
      }
      continuationToken = out.IsTruncated ? out.NextContinuationToken : undefined;
    } while (continuationToken);
    return keys;
  },
};

export const s3Keys = {
  input: (matchId: string): string => `inputs/${matchId}/raw.mp4`,
  outputVideo: (matchId: string): string => `outputs/${matchId}/annotated.mp4`,
  tracking: (matchId: string): string => `outputs/${matchId}/tracking.json`,
  events: (matchId: string): string => `outputs/${matchId}/events.json`,
  report: (matchId: string): string => `reports/${matchId}.pdf`,
};
