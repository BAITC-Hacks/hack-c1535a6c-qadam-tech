FROM python:3.12-slim-bookworm AS dependencies

ENV PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /build
COPY requirements.txt .
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

FROM python:3.12-slim-bookworm AS runtime

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app
RUN groupadd --gid 10001 toitap \
    && useradd --uid 10001 --gid toitap --no-create-home toitap
COPY --from=dependencies /opt/venv /opt/venv
COPY app ./app
# The data loader regenerates candidates.json from CSV at startup.
COPY --chown=toitap:toitap data ./data
USER toitap
EXPOSE 8765
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8765/api/health', timeout=3)" || exit 1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8765", "--no-proxy-headers"]
