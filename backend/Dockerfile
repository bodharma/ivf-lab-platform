FROM python:3.12-slim

WORKDIR /app

RUN pip install uv

# Install dependencies (cached layer)
COPY pyproject.toml uv.lock* ./
RUN uv sync --no-dev --no-install-project

# Copy application code and install project
COPY src/ src/
COPY ops_seed.py .
RUN uv sync --no-dev

ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

CMD ["uvicorn", "ivf_lab.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
