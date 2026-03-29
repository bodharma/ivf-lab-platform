from pydantic import BaseModel


class ErrorResponse(BaseModel):
    detail: str
    code: str | None = None


class PaginatedResponse(BaseModel):
    total: int
    page: int
    limit: int
