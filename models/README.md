# Pretrained Models & Checkpoints

DeepGuard utilizes two hybrid CNN-Vision Transformer architectures paired with a YOLOv8 face detector for image and video deepfake detection.

## Model Summary

| Architecture | Variant | Resolution | Params (M) | FLOPs (G) | Target Use Case | Checkpoint Filename | Source URL |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- | :--- |
| **YOLOv8n Face** | Face Detector | Dynamic | ~3.2 | ~8.7 | Face & Landmark Detection | `yolov8n-face.pt` | [v0.1.0 Release](https://github.com/HanMoonSub/DeepGuard/releases/download/v0.1.0/yolov8n-face.pt) |
| **MS-EffGCViT** | `ms_eff_gcvit_b0` | 224x224 | 8.70 | 0.85 | Fast Mode (Edge/Real-time) | `ms_eff_gcvit_b0_ff++.bin`<br>`ms_eff_gcvit_b0_kodf.bin`<br>`ms_eff_gcvit_b0_celeb_df_v2.bin` | [v0.1.0 / v0.2.0 Release](https://github.com/HanMoonSub/DeepGuard/releases/) |
| **MS-EffGCViT** | `ms_eff_gcvit_b5` | 384x384 | 50.34 | 13.43 | Pro Mode (High Precision) | `ms_eff_gcvit_b5_ff++.bin`<br>`ms_eff_gcvit_b5_kodf.bin`<br>`ms_eff_gcvit_b5_celeb_df_v2.bin` | [v0.1.0 / v0.2.0 Release](https://github.com/HanMoonSub/DeepGuard/releases/) |
| **MS-EffViT** | `ms_eff_vit_b0` | 224x224 | 5.90 | 0.68 | Fast Mode (v1 Engine) | `ms_eff_vit_b0_ff++.bin`<br>`ms_eff_vit_b0_celeb_df_v2.bin` | [v0.1.0 Release](https://github.com/HanMoonSub/DeepGuard/releases/) |
| **MS-EffViT** | `ms_eff_vit_b5` | 384x384 | 52.00 | 15.22 | Pro Mode (v1 Engine) | `ms_eff_vit_b5_ff++.bin`<br>`ms_eff_vit_b5_celeb_df_v2.bin` | [v0.1.0 Release](https://github.com/HanMoonSub/DeepGuard/releases/) |

## Checkpoint Location

- **Automatic Download**: When calling `timm.create_model(...)` or using `ImagePredictor` / `VideoPredictor`, checkpoints are automatically fetched into `~/.cache/torch/hub/checkpoints/` on first use.
- **Manual Download**: Run `python scripts/download_models.py --models default` (or `--models all`) to download weights into `models/checkpoints/`.

## Model Configurations

Configuration files defining layer depth, attention heads, window size, and hyperparameters are located in `deepguard/config/`.
