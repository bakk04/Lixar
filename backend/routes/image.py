from fastapi import APIRouter, Depends, status, HTTPException
from services import session_svc, image_svc
from sqlalchemy import Connection
from db.database import context_get_conn 
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/image", tags=["image"])

import torch
from sqlalchemy import text

# 전체 및 모델 시스템 통계 조회
@router.get("/stats", status_code=status.HTTP_200_OK, response_class=JSONResponse, summary="딥페이크 분석 시스템 통계")
async def get_system_stats(
    conn: Connection = Depends(context_get_conn)
):
    try:
        # Aggregated stats across image_result and video_result
        agg_res = await conn.execute(text("""
            SELECT 
                COUNT(*) as total_scans,
                SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as success_scans,
                SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_scans,
                SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_scans,
                SUM(CASE WHEN status = 'SUCCESS' AND label = 'FAKE' THEN 1 ELSE 0 END) as fake_count,
                SUM(CASE WHEN status = 'SUCCESS' AND label = 'REAL' THEN 1 ELSE 0 END) as real_count,
                SUM(CASE WHEN status = 'SUCCESS' AND face_conf > 0 THEN face_conf ELSE 0 END) as sum_face_conf,
                SUM(CASE WHEN status = 'SUCCESS' AND face_conf > 0 THEN 1 ELSE 0 END) as count_face_conf,
                SUM(CASE WHEN status = 'SUCCESS' AND score >= 0 THEN score ELSE 0 END) as sum_score,
                SUM(CASE WHEN status = 'SUCCESS' AND score >= 0 THEN 1 ELSE 0 END) as count_score
            FROM (
                SELECT status, label, face_conf, score FROM image_result
                UNION ALL
                SELECT status, label, face_conf, score FROM video_result
            )
        """))
        agg_row = agg_res.fetchone()

        img_res = await conn.execute(text("SELECT COUNT(*) as total FROM image_result"))
        vid_res = await conn.execute(text("SELECT COUNT(*) as total FROM video_result"))
        img_total = int(getattr(img_res.fetchone(), 'total', 0) or 0)
        vid_total = int(getattr(vid_res.fetchone(), 'total', 0) or 0)

        total_scans = int(getattr(agg_row, 'total_scans', 0) or 0)
        success_scans = int(getattr(agg_row, 'success_scans', 0) or 0)
        failed_scans = int(getattr(agg_row, 'failed_scans', 0) or 0)
        pending_scans = int(getattr(agg_row, 'pending_scans', 0) or 0)
        fake_count = int(getattr(agg_row, 'fake_count', 0) or 0)
        real_count = int(getattr(agg_row, 'real_count', 0) or 0)

        sum_face_conf = float(getattr(agg_row, 'sum_face_conf', 0.0) or 0.0)
        count_face_conf = int(getattr(agg_row, 'count_face_conf', 0) or 0)
        avg_face_conf = round(sum_face_conf / count_face_conf, 2) if count_face_conf > 0 else 0.0

        sum_score = float(getattr(agg_row, 'sum_score', 0.0) or 0.0)
        count_score = int(getattr(agg_row, 'count_score', 0) or 0)
        avg_score = round(sum_score / count_score, 4) if count_score > 0 else 0.0

        classified_total = fake_count + real_count
        fake_rate = round((fake_count / classified_total * 100), 1) if classified_total > 0 else 0.0

        # Recent combined scans from both tables
        recent_res = await conn.execute(text("""
            SELECT id, image_loc, status, label, score, face_conf, version_type, model_type, domain_type, created_at, 'IMAGE' as media_type
            FROM image_result
            UNION ALL
            SELECT id, video_loc as image_loc, status, label, score, face_conf, version_type, model_type, domain_type, created_at, 'VIDEO' as media_type
            FROM video_result
            ORDER BY created_at DESC
            LIMIT 20
        """))
        recent_scans = []
        for r in recent_res.fetchall():
            if hasattr(r, '_d'):
                recent_scans.append(dict(r._d))
            elif hasattr(r, '_mapping'):
                recent_scans.append(dict(r._mapping))
            else:
                try:
                    recent_scans.append(dict(r))
                except Exception:
                    recent_scans.append({
                        "id": getattr(r, 'id', None),
                        "image_loc": getattr(r, 'image_loc', None),
                        "status": getattr(r, 'status', None),
                        "label": getattr(r, 'label', None),
                        "score": getattr(r, 'score', None),
                        "face_conf": getattr(r, 'face_conf', None),
                        "version_type": getattr(r, 'version_type', None),
                        "model_type": getattr(r, 'model_type', None),
                        "domain_type": getattr(r, 'domain_type', None),
                        "created_at": str(getattr(r, 'created_at', None)),
                        "media_type": getattr(r, 'media_type', None)
                    })

    except Exception as e:
        print(f"[Stats Query Error] {e}")
        total_scans = 0
        success_scans = 0
        failed_scans = 0
        pending_scans = 0
        img_total = 0
        vid_total = 0
        fake_count = 0
        real_count = 0
        avg_face_conf = 0.0
        avg_score = 0.0
        fake_rate = 0.0
        recent_scans = []

    device_name = "MPS (Apple Silicon)" if torch.backends.mps.is_available() else ("CUDA GPU" if torch.cuda.is_available() else "CPU")

    return {
        "status": "success",
        "total_scans": total_scans,
        "success_scans": success_scans,
        "failed_scans": failed_scans,
        "pending_scans": pending_scans,
        "image_scans": img_total,
        "video_scans": vid_total,
        "fake_count": fake_count,
        "real_count": real_count,
        "fake_rate": fake_rate,
        "avg_face_conf": avg_face_conf,
        "avg_score": avg_score,
        "recent_scans": recent_scans,
        "model_info": {
            "name": "MS-EffGCViT-B0",
            "full_name": "Multi-Scale Efficient Global Context Vision Transformer",
            "backbone": "EfficientNet-B0 (MBConv)",
            "transformer": "Global Context ViT (Local & Global Window Attention)",
            "parameters": "8.70M",
            "gflops": "0.85 GFLOPs",
            "resolution": "224x224",
            "precision_ff": 94.8,
            "recall_ff": 93.2,
            "f1_ff": 94.0,
            "auc_ff": 99.7,
            "acc_ff": 98.1,
            "auc_celeb_df": 99.7,
            "acc_celeb_df": 98.4,
            "auc_kodf": 97.9,
            "acc_kodf": 96.6,
            "device": device_name,
            "status": "ONLINE"
        }
    }

# 사용자 전체 업로드 히스토리 조회 (회원/비회원 공용)
@router.get("/history", status_code=status.HTTP_200_OK, response_class=JSONResponse, summary="이미지 히스토리 전체 조회")
async def get_user_histories(
    conn: Connection = Depends(context_get_conn),
    session_user = Depends(session_svc.get_session_user_opt)
):
    user_id = session_user['id'] if session_user else None
    user_histories = await image_svc.get_user_histories(conn, user_id)
    
    return {
        "message": "사용자 내역을 성공적으로 불러왔습니다", 
        "status": "success",
        "context": user_histories
    }

# 특정 이미지의 상세 내역 조회 (개별 히스토리)
@router.get("/history/{image_id}", status_code=status.HTTP_200_OK, response_class=JSONResponse,summary="이미지 개별 상세 조회")
async def get_user_history(
    image_id: int,
    conn: Connection = Depends(context_get_conn),
):
    
    history = await image_svc.get_user_history(conn, image_id)

    if not history:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="해당 이미지 기록을 찾을 수 없습니다.")
        
    return {
        "message": "개별 내역을 성공적으로 불러왔습니다",
        "status": "success",
        "context": history
    }

# 이미지 히스토리 삭제
@router.delete("/history/{image_id}", status_code=status.HTTP_200_OK,response_class=JSONResponse, summary="이미지 버튼 히스토리 삭제")
async def delete_image_history(
    image_id: int,
    conn: Connection = Depends(context_get_conn),
    session_user = Depends(session_svc.get_session_user_prt) # 로그인 필수
):
    history = await image_svc.get_user_history(conn, image_id)

    if not history:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="해당 이미지 기록을 찾을 수 없습니다.")

    # DB 레코드 삭제 
    await image_svc.delete_image_db(conn, image_id)
    # 실제 이미지 삭제
    await image_svc.delete_image(history.image_loc)
    
    return {
        "message": "이미지 내역이 성공적으로 삭제되었습니다",
        "status": "success"
    }