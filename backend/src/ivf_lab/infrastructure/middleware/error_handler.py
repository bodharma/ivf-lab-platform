from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


class ErrorHandlerMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)
        except ValueError as e:
            return JSONResponse(status_code=400, content={"detail": str(e)})
        except PermissionError as e:
            return JSONResponse(status_code=403, content={"detail": str(e)})
        except Exception:
            return JSONResponse(status_code=500, content={"detail": "Internal server error"})
