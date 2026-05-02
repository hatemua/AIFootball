import { PutObjectCommand } from '@aws-sdk/client-s3';

import { S3_BUCKET, s3Client, s3Service } from '../src/services/s3.js';

async function main(): Promise<void> {
  const key = `temp/test-${Date.now()}.txt`;
  const payload = 'hello s3';

  console.log(`uploading s3://${S3_BUCKET}/${key}`);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: payload,
      ContentType: 'text/plain',
    }),
  );

  try {
    if (!(await s3Service.fileExists(key))) {
      throw new Error('file should exist after upload');
    }

    const url = await s3Service.getSignedDownloadUrl(key, 600);
    console.log(`signed url: ${url}`);

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`signed-url fetch failed: ${res.status} ${res.statusText}`);
    }
    const body = await res.text();
    if (body !== payload) {
      throw new Error(`content mismatch: ${JSON.stringify(body)} !== ${JSON.stringify(payload)}`);
    }
    console.log(`downloaded ${body.length} bytes, content matches`);
  } finally {
    await s3Service.deleteFile(key);
    console.log(`deleted s3://${S3_BUCKET}/${key}`);
  }

  if (await s3Service.fileExists(key)) {
    throw new Error('file should be gone after delete');
  }

  console.log('OK');
}

main().catch((err) => {
  console.error('test-s3 failed:', err);
  process.exit(1);
});
