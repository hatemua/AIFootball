"""File management: local working directories + S3 persistence."""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any
from uuid import uuid4

import boto3
from botocore.exceptions import ClientError

from .config import settings

logger = logging.getLogger(__name__)


# ─── Local working-directory helpers ─────────────────────────────


def ensure_dir(path: Path) -> Path:
    """Create the directory if it doesn't exist; return it."""
    path.mkdir(parents=True, exist_ok=True)
    return path


def new_workdir(base: Path, match_id: str) -> Path:
    """Allocate a fresh working directory for a match."""
    workdir = base / f"{match_id}-{uuid4().hex[:8]}"
    return ensure_dir(workdir)


def cleanup(path: Path) -> None:
    """Remove a working directory and its contents.

    TODO: implement with shutil.rmtree once we're sure jobs have finished.
    """
    logger.info("TODO: cleanup %s", path)


# ─── S3 persistence ──────────────────────────────────────────────


class S3Storage:
    """Thin wrapper around boto3 for the football-pipeline bucket."""

    def __init__(self) -> None:
        self.client = boto3.client(
            "s3",
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=settings.aws_default_region,
        )
        self.bucket = settings.s3_bucket

    def upload_file(self, local_path: str, s3_key: str) -> str:
        logger.info("S3 upload_file local=%s -> s3://%s/%s", local_path, self.bucket, s3_key)
        self.client.upload_file(local_path, self.bucket, s3_key)
        return s3_key

    def download_file(self, s3_key: str, local_path: str) -> None:
        logger.info("S3 download_file s3://%s/%s -> %s", self.bucket, s3_key, local_path)
        parent = os.path.dirname(local_path)
        if parent:
            os.makedirs(parent, exist_ok=True)
        self.client.download_file(self.bucket, s3_key, local_path)

    def upload_json(self, data: dict[str, Any], s3_key: str) -> str:
        logger.info("S3 upload_json -> s3://%s/%s", self.bucket, s3_key)
        body = json.dumps(data).encode("utf-8")
        self.client.put_object(
            Bucket=self.bucket,
            Key=s3_key,
            Body=body,
            ContentType="application/json",
        )
        return s3_key

    def download_json(self, s3_key: str) -> dict[str, Any]:
        logger.info("S3 download_json s3://%s/%s", self.bucket, s3_key)
        obj = self.client.get_object(Bucket=self.bucket, Key=s3_key)
        return json.loads(obj["Body"].read())

    def get_signed_url(self, s3_key: str, expires: int = 3600) -> str:
        logger.info("S3 presign s3://%s/%s (ttl=%ds)", self.bucket, s3_key, expires)
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": s3_key},
            ExpiresIn=expires,
        )

    def file_exists(self, s3_key: str) -> bool:
        try:
            self.client.head_object(Bucket=self.bucket, Key=s3_key)
            return True
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code")
            status = exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
            if code in ("404", "NoSuchKey", "NotFound") or status == 404:
                return False
            raise

    def delete_file(self, s3_key: str) -> None:
        logger.info("S3 delete s3://%s/%s", self.bucket, s3_key)
        self.client.delete_object(Bucket=self.bucket, Key=s3_key)

    def list_files(self, prefix: str) -> list[str]:
        logger.info("S3 list_files prefix=%s", prefix)
        keys: list[str] = []
        paginator = self.client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix):
            for obj in page.get("Contents", []) or []:
                key = obj.get("Key")
                if key:
                    keys.append(key)
        return keys


storage = S3Storage()


# ─── Standard S3 key builders (mirrored on backend) ──────────────


def s3_key_input(match_id: str) -> str:
    return f"inputs/{match_id}/raw.mp4"


def s3_key_output_video(match_id: str) -> str:
    return f"outputs/{match_id}/annotated.mp4"


def s3_key_tracking(match_id: str) -> str:
    return f"outputs/{match_id}/tracking.json"


def s3_key_events(match_id: str) -> str:
    return f"outputs/{match_id}/events.json"


def s3_key_report(match_id: str) -> str:
    return f"reports/{match_id}.pdf"
