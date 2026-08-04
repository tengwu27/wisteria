#!/usr/bin/env python3
"""Build quality-gated H.264 delivery copies of cinematic transitions.

Authoring masters live under assets/cinematic/delivery-sources, outside the
public delivery tree. The optimizer preserves resolution, duration, frame
rate, and frame count; keeps 60 fps garage motion at 60 fps; adds fast-start
metadata; and adaptively raises quality until VMAF and endpoint gates pass.

Ambient loops are intentionally excluded. They are already small and another
lossy generation would provide little loading benefit.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
from fractions import Fraction
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PUBLIC_MEDIA = ROOT / "public" / "media"
SOURCE_MEDIA = ROOT / "assets" / "cinematic" / "delivery-sources"
REPORT_PATH = SOURCE_MEDIA / "video-delivery.json"
MINIMUM_USEFUL_REDUCTION = 0.05


def run(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        check=True,
        capture_output=True,
        text=True,
    )


def probe(path: Path) -> dict[str, object]:
    result = run(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            (
                "stream=codec_name,width,height,pix_fmt,avg_frame_rate,"
                "nb_frames:format=duration,size"
            ),
            "-of",
            "json",
            str(path),
        ]
    )
    data = json.loads(result.stdout)
    stream = data["streams"][0]
    format_data = data["format"]
    return {
        "codec": stream["codec_name"],
        "width": int(stream["width"]),
        "height": int(stream["height"]),
        "pixFmt": stream["pix_fmt"],
        "fps": float(Fraction(stream["avg_frame_rate"])),
        "fpsFraction": stream["avg_frame_rate"],
        "frames": int(stream["nb_frames"]),
        "duration": float(format_data["duration"]),
        "bytes": int(format_data["size"]),
    }


def fast_start(path: Path) -> bool:
    data = path.read_bytes()
    moov = data.find(b"moov")
    mdat = data.find(b"mdat")
    return moov >= 0 and mdat >= 0 and moov < mdat


def encode(source: Path, destination: Path, fps: float, crf: int) -> None:
    gop = max(1, round(fps * 2))
    minimum_key_interval = max(1, round(fps))
    level = "4.2" if fps >= 50 else "4.1"
    run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(source),
            "-map",
            "0:v:0",
            "-map_metadata",
            "-1",
            "-c:v",
            "libx264",
            "-preset",
            "slow",
            "-crf",
            str(crf),
            "-profile:v",
            "high",
            "-level",
            level,
            "-pix_fmt",
            "yuv420p",
            "-fps_mode",
            "passthrough",
            "-g",
            str(gop),
            "-keyint_min",
            str(minimum_key_interval),
            "-sc_threshold",
            "0",
            "-movflags",
            "+faststart",
            "-an",
            str(destination),
        ]
    )


def vmaf(source: Path, delivery: Path) -> dict[str, float]:
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as handle:
        log_path = Path(handle.name)
    try:
        run(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                str(delivery),
                "-i",
                str(source),
                "-lavfi",
                (
                    "[0:v][1:v]libvmaf=n_threads=4:log_fmt=json:"
                    f"log_path={log_path}"
                ),
                "-f",
                "null",
                "-",
            ]
        )
        data = json.loads(log_path.read_text())
    finally:
        log_path.unlink(missing_ok=True)

    frames = data["frames"]
    pooled = data["pooled_metrics"]["vmaf"]
    return {
        "mean": float(pooled["mean"]),
        "minimum": float(pooled["min"]),
        "first": float(frames[0]["metrics"]["vmaf"]),
        "last": float(frames[-1]["metrics"]["vmaf"]),
    }


def validate_geometry(
    relative: Path,
    source_meta: dict[str, object],
    delivery_meta: dict[str, object],
) -> None:
    for key in ("width", "height", "frames"):
        if source_meta[key] != delivery_meta[key]:
            raise RuntimeError(
                f"{relative}: {key} changed from "
                f"{source_meta[key]} to {delivery_meta[key]}"
            )
    if delivery_meta["codec"] != "h264" or delivery_meta["pixFmt"] != "yuv420p":
        raise RuntimeError(f"{relative}: incompatible delivery codec")
    if abs(float(source_meta["fps"]) - float(delivery_meta["fps"])) > 0.001:
        raise RuntimeError(f"{relative}: frame rate changed")
    frame_duration = 1 / float(source_meta["fps"])
    if abs(float(source_meta["duration"]) - float(delivery_meta["duration"])) > frame_duration / 2:
        raise RuntimeError(f"{relative}: duration changed")


def quality_passes(metrics: dict[str, float], fps: float) -> bool:
    required_mean = 95.0 if fps >= 50 else 96.0
    return (
        metrics["mean"] >= required_mean
        and metrics["minimum"] >= 88.0
        and metrics["first"] >= 90.0
        and metrics["last"] >= 90.0
    )


def source_for(relative: Path) -> Path:
    public_path = PUBLIC_MEDIA / relative
    source_path = SOURCE_MEDIA / relative
    if not source_path.exists():
        if not public_path.exists():
            raise FileNotFoundError(relative)
        source_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(public_path, source_path)
    return source_path


def transition_paths() -> list[Path]:
    paths = {
        path.relative_to(PUBLIC_MEDIA)
        for path in PUBLIC_MEDIA.rglob("*.mp4")
        if "transitions" in path.parts
    }
    paths.update(
        path.relative_to(SOURCE_MEDIA)
        for path in SOURCE_MEDIA.rglob("*.mp4")
        if "transitions" in path.parts
    )
    return sorted(paths)


def main() -> None:
    records: list[dict[str, object]] = []
    total_source = 0
    total_delivery = 0

    for relative in transition_paths():
        source = source_for(relative)
        destination = PUBLIC_MEDIA / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        source_meta = probe(source)
        fps = float(source_meta["fps"])
        starting_crf = 20 if fps >= 50 else 22

        accepted_path: Path | None = None
        accepted_crf = starting_crf
        accepted_metrics: dict[str, float] | None = None
        accepted_meta: dict[str, object] | None = None

        for crf in range(starting_crf, 17, -1):
            temporary = destination.with_suffix(f".crf{crf}.tmp.mp4")
            encode(source, temporary, fps, crf)
            delivery_meta = probe(temporary)
            validate_geometry(relative, source_meta, delivery_meta)
            metrics = vmaf(source, temporary)
            if quality_passes(metrics, fps):
                accepted_path = temporary
                accepted_crf = crf
                accepted_metrics = metrics
                accepted_meta = delivery_meta
                break
            temporary.unlink(missing_ok=True)

        if accepted_path is None or accepted_metrics is None or accepted_meta is None:
            raise RuntimeError(f"{relative}: no encoding passed the quality gates")
        source_bytes = int(source_meta["bytes"])
        candidate_bytes = int(accepted_meta["bytes"])
        retained_source = candidate_bytes > source_bytes * (1 - MINIMUM_USEFUL_REDUCTION)
        if retained_source:
            accepted_path.unlink()
            shutil.copy2(source, destination)
            accepted_crf = None
            accepted_metrics = {
                "mean": 100.0,
                "minimum": 100.0,
                "first": 100.0,
                "last": 100.0,
            }
            accepted_meta = source_meta
        else:
            os.replace(accepted_path, destination)
        for leftover in destination.parent.glob(f"{destination.stem}.crf*.tmp.mp4"):
            leftover.unlink()
        if not fast_start(destination):
            raise RuntimeError(f"{relative}: moov atom is not fast-started")

        delivery_bytes = int(accepted_meta["bytes"])
        total_source += source_bytes
        total_delivery += delivery_bytes
        reduction = 100 * (1 - delivery_bytes / source_bytes)
        print(
            f"{relative}: "
            f"{'source retained' if retained_source else f'CRF {accepted_crf}'}, "
            f"VMAF {accepted_metrics['mean']:.2f}, "
            f"{source_bytes / 1024 / 1024:.2f} -> "
            f"{delivery_bytes / 1024 / 1024:.2f} MiB ({reduction:.1f}% smaller)"
        )
        records.append(
            {
                "file": relative.as_posix(),
                "sourceBytes": source_bytes,
                "deliveryBytes": delivery_bytes,
                "codec": "h264",
                "pixelFormat": "yuv420p",
                "width": source_meta["width"],
                "height": source_meta["height"],
                "fps": source_meta["fpsFraction"],
                "frames": source_meta["frames"],
                "duration": source_meta["duration"],
                "crf": accepted_crf,
                "preset": None if retained_source else "slow",
                "vmaf": {key: round(value, 3) for key, value in accepted_metrics.items()},
            }
        )

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(
        json.dumps(
            {
                "format": "H.264 High, yuv420p, fast-start MP4",
                "policy": {
                    "30fpsStartingCrf": 22,
                    "60fpsStartingCrf": 20,
                    "minimumUsefulReduction": MINIMUM_USEFUL_REDUCTION,
                    "preserveFrameRate": True,
                    "preserveFrameCount": True,
                    "ambientLoops": "retained without another lossy generation",
                },
                "sourceBytes": total_source,
                "deliveryBytes": total_delivery,
                "assets": records,
            },
            indent=2,
        )
        + "\n"
    )
    reduction = 100 * (1 - total_delivery / total_source)
    print(
        f"Optimized {len(records)} transitions: "
        f"{total_source / 1024 / 1024:.2f} -> "
        f"{total_delivery / 1024 / 1024:.2f} MiB "
        f"({reduction:.1f}% smaller)."
    )


if __name__ == "__main__":
    main()
