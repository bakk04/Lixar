from fastapi import Request, FastAPI
from starlette.middleware.base import BaseHTTPMiddleware
import redis.asyncio as aioredis
import uuid
import json
import logging
import os
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO)
load_dotenv()

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379)) 

# Redis setup
redis_pool = aioredis.ConnectionPool(host=REDIS_HOST, port=REDIS_PORT, db=0, max_connections=10)
redis_client = aioredis.Redis(connection_pool=redis_pool)

_in_memory_sessions: dict[str, dict] = {}
_redis_active = None

class RedisSessionMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: FastAPI, session_cookie: str = "session_redis_id", max_age: int = 3600):
        super().__init__(app)
        self.session_cookie = session_cookie
        self.max_age = max_age

    async def dispatch(self, request: Request, call_next):
        session_id = request.cookies.get(self.session_cookie)
        initial_session_was_empty = True
        
        if self.max_age is None or self.max_age <= 0:
            return await call_next(request)

        use_redis = True
        global _redis_active
        if _redis_active is False:
            use_redis = False

        if session_id:
            if use_redis:
                try:
                    session_data = await redis_client.get(session_id)
                    if session_data:
                        request.state.session = json.loads(session_data)
                        await redis_client.expire(session_id, self.max_age)
                        initial_session_was_empty = False
                    else:
                        request.state.session = {}
                    _redis_active = True
                except Exception as e:
                    _redis_active = False
                    request.state.session = _in_memory_sessions.get(session_id, {})
                    if session_id in _in_memory_sessions:
                        initial_session_was_empty = False
            else:
                request.state.session = _in_memory_sessions.get(session_id, {})
                if session_id in _in_memory_sessions:
                    initial_session_was_empty = False
        else:
            session_id = str(uuid.uuid4())
            request.state.session = {}

        try:
            response = await call_next(request)
        except Exception:
            raise

        try:
            if request.state.session:
                is_https = (
                    request.url.scheme == 'https'
                    or request.headers.get('x-forwarded-proto') == 'https')

                response.set_cookie(self.session_cookie, session_id, max_age=self.max_age, httponly=True,
                                    secure=is_https, samesite='None' if is_https else 'Lax')
                if _redis_active is not False:
                    try:
                        await redis_client.setex(session_id, self.max_age, json.dumps(request.state.session))
                    except Exception:
                        _redis_active = False
                        _in_memory_sessions[session_id] = request.state.session
                else:
                    _in_memory_sessions[session_id] = request.state.session
            else:
                if not initial_session_was_empty:
                    if _redis_active is not False:
                        try:
                            await redis_client.delete(session_id)
                        except Exception:
                            _redis_active = False
                            _in_memory_sessions.pop(session_id, None)
                    else:
                        _in_memory_sessions.pop(session_id, None)
                    response.delete_cookie(self.session_cookie)
        except Exception as e:
            logging.warning("Non-fatal session cookie/store error: " + str(e))
        
        return response