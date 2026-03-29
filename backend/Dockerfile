FROM python:3.12-slim AS base

WORKDIR /app

RUN pip install uv

COPY pyproject.toml .
RUN uv sync --no-dev --no-install-project

COPY src/ src/

ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

CMD ["uvicorn", "ivf_lab.main:app", "--host", "0.0.0.0", "--port", "8000"]
