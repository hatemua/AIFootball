"""Multi-source video downloader: YouTube (via yt-dlp) or direct HTTP URL."""

from __future__ import annotations

import logging
import subprocess
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)

_MIN_BYTES = 1024
_YT_DLP_TIMEOUT_SECONDS = 900  # 15 min cap on YouTube download
_HTTP_TIMEOUT_SECONDS = 600
_HTTP_CHUNK_BYTES = 8192


def download_video(
    source_url: str,
    output_path: str,
    cookies_path: str | None = None,
) -> str:
    """Download a video from YouTube or a direct HTTP(S) URL.

    YouTube URLs route to yt-dlp (with optional cookies for auth-walled videos).
    Anything else streams over HTTP into ``output_path``.

    Returns ``output_path`` on success. Raises RuntimeError on any failure
    (timeout, non-zero exit, missing/empty output file).
    """
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    if _is_youtube(source_url):
        logger.info("Downloading YouTube video: %s", source_url)
        return _download_youtube(source_url, output_path, cookies_path)

    logger.info("Downloading direct video: %s", source_url)
    return _download_direct(source_url, output_path)


def _is_youtube(url: str) -> bool:
    lowered = url.lower()
    return "youtube.com" in lowered or "youtu.be" in lowered


def _download_youtube(
    url: str,
    output_path: str,
    cookies_path: str | None,
) -> str:
    cmd = [
        "yt-dlp",
        "-f", "b",
        "--remote-components", "ejs:github",
        "-o", output_path,
        url,
    ]

    if cookies_path and Path(cookies_path).exists():
        cmd.extend(["--cookies", cookies_path])
        logger.info("Using YouTube cookies from %s", cookies_path)
    else:
        logger.warning("No cookies file — YouTube may block this download")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=_YT_DLP_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(
            f"yt-dlp timed out after {_YT_DLP_TIMEOUT_SECONDS}s"
        ) from exc

    if result.returncode != 0:
        tail = (result.stderr or "unknown error")[-2000:]
        raise RuntimeError(
            f"yt-dlp failed (exit {result.returncode}): {tail}"
        )

    return _verify_downloaded(output_path)


def _download_direct(url: str, output_path: str) -> str:
    try:
        with httpx.stream(
            "GET",
            url,
            timeout=_HTTP_TIMEOUT_SECONDS,
            follow_redirects=True,
        ) as response:
            response.raise_for_status()
            with open(output_path, "wb") as f:
                for chunk in response.iter_bytes(chunk_size=_HTTP_CHUNK_BYTES):
                    if chunk:
                        f.write(chunk)
    except httpx.HTTPError as exc:
        raise RuntimeError(f"HTTP download failed: {exc}") from exc

    return _verify_downloaded(output_path)


def _verify_downloaded(output_path: str) -> str:
    path = Path(output_path)
    if not path.exists():
        raise RuntimeError(f"Download reported success but file missing: {output_path}")
    size = path.stat().st_size
    if size < _MIN_BYTES:
        raise RuntimeError(f"Downloaded file suspiciously small: {size} bytes")
    logger.info("Downloaded %.1f MB to %s", size / 1024 / 1024, output_path)
    return output_path
