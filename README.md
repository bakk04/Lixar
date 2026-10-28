# DeepGuard: Deepfake Image & Video Detection

A focused, lightweight deepfake detection system powered by hybrid CNN-Vision Transformer architectures (**MS-EffGCViT** and **MS-EffViT**), YOLOv8 face detection, and dual-branch Grad-CAM explainability (XAI).

## Project Structure

```
DeepGuard-Clean/
├── backend/            # FastAPI REST API backend & Celery async worker
│   ├── routes/         # API endpoints (/auth, /inference, /video, /image, /explain)
│   ├── services/       # Inference, explainability, session, and DB services
│   ├── schemas/        # Pydantic request/response schemas
│   ├── db/             # SQLAlchemy async database engines
│   ├── static/         # Uploaded images/videos and generated XAI overlays
│   └── sql/            # Database initialization scripts
├── frontend/           # React frontend UI (Create React App)
│   ├── public/         # Static assets and demo samples (images & videos)
│   └── src/            # Pages (Analysis, Video, Heatmap, Timeline) and components
├── deepguard/          # Core PyTorch models (MS-EffGCViT, MS-EffViT), layers, transforms
├── inference/          # ImagePredictor and VideoPredictor inference pipelines
├── preprocess/         # YOLOv8 face detector, landmark extractor, frame sampling
├── explainability/     # Dual-branch XAI explainers (HiResCAM, Grad-CAM++, etc.)
├── models/             # Model architectures, configurations, and checkpoint cards
├── scripts/            # Checkpoint download script (download_models.py)
├── docs/               # Architecture diagrams and model documentation
├── requirements.txt    # Python dependencies
└── README.md           # Setup and execution guide
```

---

## 1. Prerequisites

- **Python**: 3.10 or 3.11
- **Node.js**: 18+ and **npm**
- **Redis**: 6.0+ (required for session management and Celery async queue)
- **MySQL**: 8.0+ (required for persistent analysis history and auth)

---

## 2. Model Checkpoints

Model checkpoints are hosted on GitHub Releases and downloaded on-demand or via the download script:

```bash
# Download default models (yolov8n-face and ms_eff_gcvit_b0_ff++)
python scripts/download_models.py --models default

# Or download all available variants
python scripts/download_models.py --models all
```

Checkpoints will be saved to `models/checkpoints/` and automatically resolved by PyTorch/timm.

| Model | Variant | Checkpoint Filename | Resolution | Params |
| :--- | :--- | :--- | :---: | :---: |
| **YOLOv8n Face** | Detector | `yolov8n-face.pt` | Dynamic | ~3.2M |
| **MS-EffGCViT** | Fast Mode (b0) | `ms_eff_gcvit_b0_ff++.bin` | 224x224 | 8.70M |
| **MS-EffGCViT** | Fast Mode (b0, Asian) | `ms_eff_gcvit_b0_kodf.bin` | 224x224 | 8.70M |
| **MS-EffGCViT** | Pro Mode (b5) | `ms_eff_gcvit_b5_ff++.bin` | 384x384 | 50.34M |
| **MS-EffViT** | Fast Mode (b0) | `ms_eff_vit_b0_ff++.bin` | 224x224 | 5.90M |
| **MS-EffViT** | Pro Mode (b5) | `ms_eff_vit_b5_ff++.bin` | 384x384 | 52.00M |

---

## 3. Installation

### Python Environment

```bash
# 1. Create and activate a virtual environment
python3.11 -m venv .venv
source .venv/bin/activate

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Install deepguard package in editable mode
pip install -e .
```

### Frontend Environment

```bash
cd frontend
npm install
cd ..
```

---

## 4. Running Locally (Without Docker)

### Step 1: Start Redis and MySQL

Ensure Redis and MySQL are running on your system.
Create the database and apply the schema:

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS deepguard_db;"
mysql -u root -p deepguard_db < backend/sql/01_user.sql
mysql -u root -p deepguard_db < backend/sql/02_image_result.sql
mysql -u root -p deepguard_db < backend/sql/03_video_result.sql
mysql -u root -p deepguard_db < backend/sql/04_video_frame_result.sql
mysql -u root -p deepguard_db < backend/sql/05_video_frame_result.sql
```

Configure `backend/.env` (copy from `backend/.env.example`):

```bash
cp backend/.env.example backend/.env
```

### Step 2: Start the FastAPI Backend

```bash
cd backend
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

The backend REST API will be available at `http://127.0.0.1:8000`.

### Step 3: Start the Celery Worker (Async Inference & XAI)

In a separate terminal:

```bash
cd backend
celery -A celery_app worker --loglevel=info
```

### Step 4: Start the React Frontend

In another terminal:

```bash
cd frontend
npm start
```

The application UI opens at `http://localhost:3000`. Frontend API requests (`/api/*`) and static uploads (`/static/*`) are automatically proxied to the backend on `:8000`.

---

## 5. Python Inference (Standalone / Script)

You can run deepfake detection directly from Python without launching the full web application:

### Image Deepfake Detection

```python
from inference.image_predictor import ImagePredictor

predictor = ImagePredictor(
    margin_ratio=0.2,       # Margin around face crop
    conf_thres=0.5,         # Face detection confidence threshold
    min_face_ratio=0.01,    # Minimum face size relative to image
    model_name="ms_eff_gcvit_b0",  # or ms_eff_gcvit_b5, ms_eff_vit_b0
    dataset="ff++"          # or kodf, celeb_df_v2
)

probability = predictor.predict_img(img_path="docs/samples/images/western/western_fake_1.JPG")
print(f"Deepfake Probability: {probability:.4f}")
```

### Video Deepfake Detection

```python
from inference.video_predictor import VideoPredictor

predictor = VideoPredictor(
    margin_ratio=0.2,
    conf_thres=0.5,
    min_face_ratio=0.01,
    model_name="ms_eff_gcvit_b0",
    dataset="ff++"
)

probability = predictor.predict_video(
    video_path="docs/samples/videos/western/western_fake.mp4",
    num_frames=20,          # Uniformly sample 20 frames
    agg_mode="conf"         # Aggregation: 'conf', 'mean', or 'vote'
)
print(f"Deepfake Probability: {probability:.4f}")
```

---

## 6. License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 7. Parallel Execution (Quick Test)

To run the Backend, Celery Worker, and Frontend together in parallel for testing:

```bash
# Option 1: Using the all-in-one script (handles graceful shutdown on Ctrl+C)
./start_all.sh

# Option 2: Run in parallel directly from your terminal
(cd backend && ../.venv/bin/uvicorn main:app --reload --host 127.0.0.1 --port 8000) & (cd backend && ../.venv/bin/celery -A celery_app worker --loglevel=info) & (cd frontend && npm start)
```

