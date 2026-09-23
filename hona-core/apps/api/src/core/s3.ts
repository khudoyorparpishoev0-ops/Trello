import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3'
import type { AppConfig } from './config/env.js'

/**
 * S3/MinIO. Phase 1 — только проверка доступности bucket для readiness.
 * Загрузки, presigned-ссылки и вложения — Phase 10 (§12).
 */
export function createS3(config: AppConfig): S3Client {
  return new S3Client({
    endpoint: config.s3.endpoint,
    region: config.s3.region,
    forcePathStyle: true,
    credentials: { accessKeyId: config.s3.accessKey, secretAccessKey: config.s3.secretKey },
  })
}

/** Readiness: HeadBucket не дольше `timeoutMs`, без повторов SDK. */
export async function headBucket(s3: S3Client, bucket: string, timeoutMs: number): Promise<void> {
  await s3.send(new HeadBucketCommand({ Bucket: bucket }), {
    abortSignal: AbortSignal.timeout(timeoutMs),
  })
}
