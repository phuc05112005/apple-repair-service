FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 TZ=Asia/Ho_Chi_Minh
WORKDIR /app/ml
RUN useradd --create-home --uid 10001 app
COPY ml/requirements-runtime.txt ./requirements-runtime.txt
RUN pip install --no-cache-dir -r requirements-runtime.txt
COPY ml/ ./
USER app
EXPOSE 8001
CMD ["uvicorn","runtime_api.app:app","--host","0.0.0.0","--port","8001","--workers","1"]
