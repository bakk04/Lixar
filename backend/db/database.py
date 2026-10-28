import os
import sqlite3
import asyncio
from pathlib import Path
from dotenv import load_dotenv
from fastapi import status
from fastapi.exceptions import HTTPException
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.pool import NullPool
from sqlalchemy import text
from contextlib import asynccontextmanager

load_dotenv()
DB_USER = os.getenv("DB_USER", "deepguard")
DB_PASSWORD = os.getenv("DB_PASSWORD", "deepguard")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_NAME = os.getenv("DB_NAME", "deepguard_db")

DATABASE_CONN = f"mysql+aiomysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine: AsyncEngine = create_async_engine(
    url=DATABASE_CONN,
    pool_size=10,
    max_overflow=2,
    pool_recycle=3600
)

celery_engine: AsyncEngine = create_async_engine(
    url=DATABASE_CONN,
    poolclass=NullPool
)

# SQLite Fallback Engine
BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BACKEND_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
SQLITE_DB_PATH = str(DATA_DIR / "lixar.db")

_SQLITE_INIT_DDL = """
CREATE TABLE IF NOT EXISTS user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    hashed_password TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS image_result (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NULL,
    image_loc TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'PENDING',
    label TEXT NOT NULL,
    score REAL NOT NULL,
    face_conf REAL NOT NULL,
    face_ratio REAL NOT NULL,
    face_brightness REAL NOT NULL,
    version_type TEXT NOT NULL,
    model_type TEXT NOT NULL,
    domain_type TEXT NOT NULL,
    result_msg TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS video_result (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NULL,
    video_loc TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'PENDING',
    label TEXT NOT NULL,
    score REAL NOT NULL,
    face_conf REAL NOT NULL,
    face_ratio REAL NOT NULL,
    face_brightness REAL NOT NULL,
    version_type TEXT NOT NULL,
    model_type TEXT NOT NULL,
    domain_type TEXT NOT NULL,
    result_msg TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS video_meta_result (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER NOT NULL UNIQUE,
    fps REAL NOT NULL,
    total_frames INTEGER NOT NULL,
    num_sampled INTEGER NOT NULL,
    num_extracted INTEGER NOT NULL,
    num_detected INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS video_frame_result (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER NOT NULL,
    frame_index INTEGER NOT NULL,
    frame_time REAL NOT NULL,
    score REAL NOT NULL,
    face_conf REAL NOT NULL,
    face_ratio REAL NOT NULL,
    face_brightness REAL NOT NULL
);
"""

def init_sqlite_db():
    conn = sqlite3.connect(SQLITE_DB_PATH)
    try:
        conn.executescript(_SQLITE_INIT_DDL)
        conn.commit()
    finally:
        conn.close()

init_sqlite_db()

class RowWrapper:
    def __init__(self, data_dict, values_list):
        self._d = data_dict
        self._v = values_list
    def __getattr__(self, name):
        if name in self._d:
            return self._d[name]
        raise AttributeError(f"'Row' object has no attribute '{name}'")
    def __getitem__(self, item):
        if isinstance(item, int):
            return self._v[item]
        return self._d[item]
    def __iter__(self):
        return iter(self._v)
    def __len__(self):
        return len(self._v)
    def __repr__(self):
        return f"Row({self._d})"

class SQLiteResult:
    def __init__(self, cursor):
        self.cursor = cursor
        self.lastrowid = cursor.lastrowid
        if cursor.description:
            cols = [col[0] for col in cursor.description]
            raw_rows = cursor.fetchall()
            self._rows = [RowWrapper(dict(zip(cols, r)), list(r)) for r in raw_rows]
            self.rowcount = len(self._rows)
        else:
            self._rows = []
            self.rowcount = cursor.rowcount

    def fetchone(self):
        if self._rows:
            return self._rows.pop(0)
        return None

    def fetchall(self):
        rows = self._rows
        self._rows = []
        return rows

    def __iter__(self):
        return iter(self.fetchall())

    def close(self):
        try:
            self.cursor.close()
        except Exception:
            pass

class AsyncSQLiteConn:
    def __init__(self, db_path: str = SQLITE_DB_PATH):
        self.db_path = db_path
        self._conn = None

    def _get_sync_conn(self):
        if self._conn is None:
            self._conn = sqlite3.connect(self.db_path, check_same_thread=False)
            self._conn.row_factory = sqlite3.Row
        return self._conn

    async def execute(self, stmt, params=None):
        sql = getattr(stmt, 'text', str(stmt))
        bound_params = {}
        if hasattr(stmt, 'compile'):
            try:
                bound_params = dict(stmt.compile().params or {})
            except Exception:
                pass
        if isinstance(params, dict):
            bound_params.update(params)

        def _exec():
            conn = self._get_sync_conn()
            cur = conn.cursor()
            if isinstance(params, list):
                cur.executemany(sql, params)
            elif bound_params:
                cur.execute(sql, bound_params)
            else:
                cur.execute(sql)
            return SQLiteResult(cur)

        return await asyncio.to_thread(_exec)

    async def commit(self):
        def _commit():
            if self._conn:
                self._conn.commit()
        await asyncio.to_thread(_commit)

    async def rollback(self):
        def _rollback():
            if self._conn:
                self._conn.rollback()
        await asyncio.to_thread(_rollback)

    async def close(self):
        def _close():
            if self._conn:
                self._conn.close()
                self._conn = None
        await asyncio.to_thread(_close)

_mysql_available = None

async def is_mysql_available() -> bool:
    global _mysql_available
    if _mysql_available is not None:
        return _mysql_available
    try:
        # Test connection with 1.5s timeout
        async with asyncio.timeout(1.5):
            conn = await engine.connect()
            await conn.execute(text("SELECT 1"))
            await conn.close()
        _mysql_available = True
        print("[Database] Connected successfully to MySQL database.")
    except Exception as e:
        _mysql_available = False
        print(f"[Database] MySQL unavailable ({e}). Falling back to persistent SQLite at {SQLITE_DB_PATH}.")
    return _mysql_available

async def context_get_conn():
    use_mysql = await is_mysql_available()
    if use_mysql:
        conn = None
        try:
            conn = await engine.connect()
            yield conn
        except SQLAlchemyError as e:
            print(f"[MySQL Error] {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="요청하신 서비스가 잠시 내부적으로 문제가 발생하였습니다"
            )
        finally:
            if conn:
                await conn.close()
    else:
        sqlite_conn = AsyncSQLiteConn(SQLITE_DB_PATH)
        try:
            yield sqlite_conn
        finally:
            await sqlite_conn.close()

@asynccontextmanager
async def celery_db_conn():
    use_mysql = await is_mysql_available()
    if use_mysql:
        conn = await celery_engine.connect()
        try:
            yield conn
        finally:
            await conn.close()
    else:
        sqlite_conn = AsyncSQLiteConn(SQLITE_DB_PATH)
        try:
            yield sqlite_conn
        finally:
            await sqlite_conn.close()