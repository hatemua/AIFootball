"""yt-dlp wrapper for downloading match videos."""

from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def download(url: str, out_dir: Path) -> Path:
    """Download a YouTube video and return the path to the resulting file.

    TODO: implement using yt_dlp.YoutubeDL with options:
      - format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/mp4'
      - outtmpl: out_dir / '%(id)s.%(ext)s'
      - quiet: True
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    logger.info("TODO: download %s into %s", url, out_dir)
    raise NotImplementedError("yt-dlp download not implemented yet")
