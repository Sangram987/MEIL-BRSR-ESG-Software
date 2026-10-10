"""
Routes/services call store_bytes()/read_bytes()/delete() and never touch MinIO or the
filesystem directly — STORAGE_BACKEND env var picks the implementation, so switching from the
local dev fallback to real MinIO/S3 in production is a config change, not a code change.
"""
import os
import hashlib
from flask import current_app


def _minio_client():
    from minio import Minio
    cfg = current_app.config
    client = Minio(cfg["MINIO_ENDPOINT"], access_key=cfg["MINIO_ACCESS_KEY"],
                    secret_key=cfg["MINIO_SECRET_KEY"], secure=cfg["MINIO_SECURE"])
    bucket = cfg["MINIO_BUCKET"]
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)
    return client, bucket


def sha256_of(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def store_bytes(data: bytes, storage_key: str) -> str:
    backend = current_app.config.get("STORAGE_BACKEND", "local")
    if backend == "minio":
        import io
        client, bucket = _minio_client()
        client.put_object(bucket, storage_key, io.BytesIO(data), length=len(data))
        return storage_key
    root = current_app.config["LOCAL_STORAGE_DIR"]
    path = os.path.join(root, storage_key)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    return storage_key


def read_bytes(storage_key: str) -> bytes:
    backend = current_app.config.get("STORAGE_BACKEND", "local")
    if backend == "minio":
        client, bucket = _minio_client()
        resp = client.get_object(bucket, storage_key)
        try:
            return resp.read()
        finally:
            resp.close()
            resp.release_conn()
    root = current_app.config["LOCAL_STORAGE_DIR"]
    with open(os.path.join(root, storage_key), "rb") as f:
        return f.read()


def delete(storage_key: str):
    backend = current_app.config.get("STORAGE_BACKEND", "local")
    if backend == "minio":
        client, bucket = _minio_client()
        client.remove_object(bucket, storage_key)
        return
    root = current_app.config["LOCAL_STORAGE_DIR"]
    path = os.path.join(root, storage_key)
    if os.path.exists(path):
        os.remove(path)


ALLOWED_EXTENSIONS = {"pdf", "xlsx", "xls", "csv", "jpg", "jpeg", "png", "webp", "tiff", "tif", "docx", "zip"}
MAX_SIZES = {"pdf": 10, "xlsx": 20, "xls": 20, "csv": 10, "jpg": 10, "jpeg": 10, "png": 10, "webp": 10, "tiff": 15, "tif": 15, "docx": 10, "zip": 25}  # MB


def validate_upload(filename: str, size_bytes: int):
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        return False, f"File type .{ext} is not allowed."
    max_bytes = MAX_SIZES.get(ext, 10) * 1024 * 1024
    if size_bytes > max_bytes:
        return False, f"File exceeds the {MAX_SIZES.get(ext, 10)} MB limit for .{ext} files."
    return True, None
