#!/bin/sh
# HONA Core 2.0 — инициализация MinIO для dev и CI (§12.1, §23.6). Идемпотентно.
#   • bucket $S3_BUCKET, приватный (anonymous none);
#   • пользователь приложения $S3_ACCESS_KEY с доступом только к этому bucket
#     (приложение не работает под root-учёткой MinIO).
# CORS задаёт сервер (MINIO_API_CORS_ALLOW_ORIGIN = APP_ORIGIN). Секреты не печатаются.
set -eu

: "${MINIO_ENDPOINT:?MINIO_ENDPOINT is required}"
: "${MINIO_ROOT_USER:?MINIO_ROOT_USER is required}"
: "${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD is required}"
: "${S3_BUCKET:?S3_BUCKET is required}"
: "${S3_ACCESS_KEY:?S3_ACCESS_KEY is required}"
: "${S3_SECRET_KEY:?S3_SECRET_KEY is required}"

CONFIG_DIR="$(mktemp -d)"
mcx() { mc --config-dir "$CONFIG_DIR" --quiet "$@"; }

attempt=0
until mcx alias set hona "$MINIO_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 60 ]; then
    echo "minio-init: MinIO is not reachable at $MINIO_ENDPOINT" >&2
    exit 1
  fi
  sleep 1
done

mcx mb --ignore-existing "hona/$S3_BUCKET" >/dev/null
mcx anonymous set none "hona/$S3_BUCKET" >/dev/null

POLICY_FILE="$CONFIG_DIR/hona-app-policy.json"
cat >"$POLICY_FILE" <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": ["arn:aws:s3:::$S3_BUCKET"]
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": ["arn:aws:s3:::$S3_BUCKET/*"]
    }
  ]
}
POLICY

mcx admin policy create hona hona-app "$POLICY_FILE" >/dev/null
mcx admin user add hona "$S3_ACCESS_KEY" "$S3_SECRET_KEY" >/dev/null
# attach падает, если политика уже привязана — это нормальное состояние при повторном запуске
mcx admin policy attach hona hona-app --user "$S3_ACCESS_KEY" >/dev/null 2>&1 || true

anonymous="$(mcx anonymous get "hona/$S3_BUCKET")"
echo "minio-init: ok — bucket $S3_BUCKET, $anonymous"
