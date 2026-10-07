FROM python:3.11-slim

# gcc/libffi/build-essential are needed to build argon2-cffi, cryptography, and lxml wheels
# on some platforms; removed after pip install to keep the image small.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential gcc libffi-dev libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p instance/uploads

EXPOSE 5000

ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1

CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "--timeout", "120", "run:app"]
