#!/usr/bin/env python3
"""
Model download helper script for DeepGuard.
Downloads pretrained weights for face detection (YOLOv8) and deepfake classifiers (MS-EffGCViT / MS-EffViT).
"""

import os
import sys
import argparse
import urllib.request
from pathlib import Path

MODEL_REGISTRY = {
    "yolov8n-face": {
        "filename": "yolov8n-face.pt",
        "url": "https://github.com/HanMoonSub/DeepGuard/releases/download/v0.1.0/yolov8n-face.pt",
        "description": "YOLOv8n Face Detection & Landmark weights",
    },
    # MS-EffGCViT (Engine v2)
    "ms_eff_gcvit_b0_ff++": {
        "filename": "ms_eff_gcvit_b0_ff++.bin",
        "url": "https://github.com/HanMoonSub/DeepGuard/releases/download/v0.1.0/ms_eff_gcvit_b0_ff++.bin",
        "description": "MS-EffGCViT-B0 trained on FaceForensics++ (Fast mode, Western)",
    },
    "ms_eff_gcvit_b0_kodf": {
        "filename": "ms_eff_gcvit_b0_kodf.bin",
        "url": "https://github.com/HanMoonSub/DeepGuard/releases/download/v0.2.0/ms_eff_gcvit_b0_kodf.bin",
        "description": "MS-EffGCViT-B0 trained on KoDF (Fast mode, Asian)",
    },
    "ms_eff_gcvit_b0_celeb_df_v2": {
        "filename": "ms_eff_gcvit_b0_celeb_df_v2.bin",
        "url": "https://github.com/HanMoonSub/DeepGuard/releases/download/v0.1.0/ms_eff_gcvit_b0_celeb_df_v2.bin",
        "description": "MS-EffGCViT-B0 trained on Celeb-DF-v2",
    },
    "ms_eff_gcvit_b5_ff++": {
        "filename": "ms_eff_gcvit_b5_ff++.bin",
        "url": "https://github.com/HanMoonSub/DeepGuard/releases/download/v0.1.0/ms_eff_gcvit_b5_ff++.bin",
        "description": "MS-EffGCViT-B5 trained on FaceForensics++ (Pro mode, Western)",
    },
    "ms_eff_gcvit_b5_kodf": {
        "filename": "ms_eff_gcvit_b5_kodf.bin",
        "url": "https://github.com/HanMoonSub/DeepGuard/releases/download/v0.2.0/ms_eff_gcvit_b5_kodf.bin",
        "description": "MS-EffGCViT-B5 trained on KoDF (Pro mode, Asian)",
    },
    "ms_eff_gcvit_b5_celeb_df_v2": {
        "filename": "ms_eff_gcvit_b5_celeb_df_v2.bin",
        "url": "https://github.com/HanMoonSub/DeepGuard/releases/download/v0.1.0/ms_eff_gcvit_b5_celeb_df_v2.bin",
        "description": "MS-EffGCViT-B5 trained on Celeb-DF-v2",
    },
    # MS-EffViT (Engine v1)
    "ms_eff_vit_b0_ff++": {
        "filename": "ms_eff_vit_b0_ff++.bin",
        "url": "https://github.com/HanMoonSub/DeepGuard/releases/download/v0.1.0/ms_eff_vit_b0_ff++.bin",
        "description": "MS-EffViT-B0 trained on FaceForensics++",
    },
    "ms_eff_vit_b5_ff++": {
        "filename": "ms_eff_vit_b5_ff++.bin",
        "url": "https://github.com/HanMoonSub/DeepGuard/releases/download/v0.1.0/ms_eff_vit_b5_ff++.bin",
        "description": "MS-EffViT-B5 trained on FaceForensics++",
    },
}

DEFAULT_MODELS = [
    "yolov8n-face",
    "ms_eff_gcvit_b0_ff++",
]

def download_file(url: str, dest_path: Path):
    if dest_path.exists():
        print(f" [EXISTS] {dest_path.name} ({dest_path.stat().st_size / (1024*1024):.2f} MB)")
        return

    print(f" [DOWNLOADING] {dest_path.name} from {url}...")
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = dest_path.with_suffix(dest_path.suffix + ".tmp")
    
    def reporthook(block_num, block_size, total_size):
        downloaded = block_num * block_size
        if total_size > 0:
            percent = min(100.0, downloaded * 100.0 / total_size)
            sys.stdout.write(f"\r  Progress: {percent:.1f}% ({downloaded / (1024*1024):.1f}/{total_size / (1024*1024):.1f} MB)")
        else:
            sys.stdout.write(f"\r  Downloaded: {downloaded / (1024*1024):.1f} MB")
        sys.stdout.flush()

    try:
        urllib.request.urlretrieve(url, temp_path, reporthook=reporthook)
        print()
        temp_path.rename(dest_path)
        print(f" [DONE] Saved to {dest_path}")
    except Exception as e:
        if temp_path.exists():
            temp_path.unlink()
        print(f"\n [ERROR] Failed to download {url}: {e}")
        raise

def main():
    parser = argparse.ArgumentParser(description="Download DeepGuard model checkpoints.")
    parser.add_argument(
        "--models",
        nargs="+",
        choices=list(MODEL_REGISTRY.keys()) + ["all", "default"],
        default=["default"],
        help="Models to download. 'default' downloads yolov8n-face and ms_eff_gcvit_b0_ff++.",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="models/checkpoints",
        help="Destination directory for downloaded weights (default: models/checkpoints).",
    )
    parser.add_argument(
        "--sync-torch-hub",
        action="store_true",
        help="Also link or copy checkpoints to torch.hub cache for automatic timm loading.",
    )
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parent.parent
    dest_dir = (project_root / args.output_dir).resolve()
    dest_dir.mkdir(parents=True, exist_ok=True)

    selected = []
    if "all" in args.models:
        selected = list(MODEL_REGISTRY.keys())
    elif "default" in args.models:
        selected = DEFAULT_MODELS
    else:
        selected = args.models

    print(f"Downloading {len(selected)} model(s) to: {dest_dir}")
    for key in selected:
        info = MODEL_REGISTRY[key]
        dest = dest_dir / info["filename"]
        print(f"\n* {key}: {info['description']}")
        download_file(info["url"], dest)

        if args.sync_torch_hub:
            try:
                import torch
                hub_checkpoints = Path(torch.hub.get_dir()) / "checkpoints"
                hub_checkpoints.mkdir(parents=True, exist_ok=True)
                hub_target = hub_checkpoints / info["filename"]
                if not hub_target.exists():
                    try:
                        hub_target.symlink_to(dest)
                        print(f"  Linked to torch.hub cache: {hub_target}")
                    except OSError:
                        import shutil
                        shutil.copy2(dest, hub_target)
                        print(f"  Copied to torch.hub cache: {hub_target}")
            except ImportError:
                pass

    print("\nDownload process completed.")

if __name__ == "__main__":
    main()
