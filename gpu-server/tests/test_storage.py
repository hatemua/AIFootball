"""Round-trip integration test for S3Storage.

Run as a script:
    python -m tests.test_storage

Or via pytest:
    pytest tests/test_storage.py
"""

from __future__ import annotations

import tempfile
import time
from pathlib import Path

from src.storage import storage


def test_s3_round_trip() -> None:
    """Upload → exists → download → presign → delete → gone."""
    payload = b"hello s3"
    key = f"temp/test-{int(time.time())}.txt"

    upload_path = Path(tempfile.mkstemp(suffix=".txt")[1])
    download_path = Path(tempfile.mkstemp(suffix=".txt")[1])
    upload_path.write_bytes(payload)

    try:
        storage.upload_file(str(upload_path), key)
        print(f"uploaded s3://{storage.bucket}/{key}")

        assert storage.file_exists(key) is True, "file should exist after upload"

        storage.download_file(key, str(download_path))
        downloaded = download_path.read_bytes()
        assert downloaded == payload, f"content mismatch: {downloaded!r} != {payload!r}"
        print(f"downloaded {len(downloaded)} bytes, content matches")

        url = storage.get_signed_url(key, expires=600)
        print(f"signed url: {url}")
    finally:
        try:
            storage.delete_file(key)
            print(f"deleted s3://{storage.bucket}/{key}")
        except Exception as exc:
            print(f"cleanup failed: {exc}")
        for p in (upload_path, download_path):
            try:
                p.unlink(missing_ok=True)
            except Exception:
                pass

    assert storage.file_exists(key) is False, "file should be gone after delete"


if __name__ == "__main__":
    test_s3_round_trip()
    print("OK")
