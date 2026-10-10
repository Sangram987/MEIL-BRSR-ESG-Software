"""
VERIGRAPH Evidence Quality Assurance Service.
Performs OpenCV-based document & image quality checking:
  - Blur detection (Laplacian variance)
  - Brightness / Darkness / Exposure analysis
  - Contrast check (Histogram standard deviation)
  - Glare / Reflection detection (high intensity saturation thresholding)
  - Resolution and minimum dimension check
  - File size & format validity
Returns comprehensive decision: ACCEPT vs RETAKE, individual metrics, and recommendations.
Never passes low-quality unreadable evidence to downstream OCR.
"""
import io
import numpy as np
from PIL import Image

try:
    import cv2
    HAS_OPENCV = True
except ImportError:
    HAS_OPENCV = False


class QualityCheckResult:
    def __init__(self, is_acceptable: bool, quality_score: int, ocr_ready: bool,
                 recommendation: str, metrics: dict, issues: list):
        self.is_acceptable = is_acceptable
        self.quality_score = quality_score
        self.ocr_ready = ocr_ready
        self.recommendation = recommendation
        self.metrics = metrics
        self.issues = issues

    def to_dict(self):
        return {
            "acceptable": self.is_acceptable,
            "qualityScore": self.quality_score,
            "ocrReady": self.ocr_ready,
            "recommendation": self.recommendation,
            "metrics": self.metrics,
            "issues": self.issues,
        }


def analyze_image_quality(file_bytes: bytes, filename: str = "document.jpg") -> QualityCheckResult:
    """
    Analyzes an image or PDF page and outputs strict quality verification metrics.
    """
    issues = []
    file_size_kb = len(file_bytes) / 1024.0

    if len(file_bytes) < 1000:
        return QualityCheckResult(
            is_acceptable=False,
            quality_score=10,
            ocr_ready=False,
            recommendation="Retake — File is empty or corrupt.",
            metrics={"fileSizeKb": round(file_size_kb, 1)},
            issues=["File is suspiciously small or corrupted."]
        )

    # Load image via PIL first (works for PNG/JPEG and converted PDF pages)
    try:
        pil_img = Image.open(io.BytesIO(file_bytes))
        width, height = pil_img.size
        format_name = pil_img.format or "UNKNOWN"
    except Exception as e:
        # Check if tabular document (CSV/TSV/XLSX/XLS)
        lower_fn = filename.lower()
        if lower_fn.endswith((".csv", ".tsv")):
            try:
                import pandas as pd
                df = pd.read_csv(io.BytesIO(file_bytes), nrows=10)
                if df.empty or len(df.columns) == 0:
                    return QualityCheckResult(
                        is_acceptable=False, quality_score=20, ocr_ready=False,
                        recommendation="Retake — CSV document is empty.",
                        metrics={"rows": 0, "fileSizeKb": round(file_size_kb, 1)},
                        issues=["CSV file contains no rows or columns."]
                    )
                return QualityCheckResult(
                    is_acceptable=True, quality_score=95, ocr_ready=True,
                    recommendation="Accept — Valid structured CSV dataset ready for fact extraction.",
                    metrics={"columns": len(df.columns), "fileSizeKb": round(file_size_kb, 1), "format": "CSV"},
                    issues=[]
                )
            except Exception as csv_err:
                return QualityCheckResult(
                    is_acceptable=False, quality_score=15, ocr_ready=False,
                    recommendation="Retake — Corrupt or unparseable CSV file.",
                    metrics={"fileSizeKb": round(file_size_kb, 1)},
                    issues=[f"Corrupt CSV format: {str(csv_err)}"]
                )

        if lower_fn.endswith((".xlsx", ".xls")):
            try:
                import pandas as pd
                df = pd.read_excel(io.BytesIO(file_bytes), nrows=10)
                if df.empty or len(df.columns) == 0:
                    return QualityCheckResult(
                        is_acceptable=False, quality_score=20, ocr_ready=False,
                        recommendation="Retake — Excel workbook is empty.",
                        metrics={"rows": 0, "fileSizeKb": round(file_size_kb, 1)},
                        issues=["Excel sheet contains no data."]
                    )
                return QualityCheckResult(
                    is_acceptable=True, quality_score=95, ocr_ready=True,
                    recommendation="Accept — Valid structured Excel workbook ready for fact extraction.",
                    metrics={"columns": len(df.columns), "fileSizeKb": round(file_size_kb, 1), "format": "XLSX"},
                    issues=[]
                )
            except Exception as excel_err:
                return QualityCheckResult(
                    is_acceptable=False, quality_score=15, ocr_ready=False,
                    recommendation="Retake — Corrupt Excel document.",
                    metrics={"fileSizeKb": round(file_size_kb, 1)},
                    issues=[f"Corrupt Excel workbook: {str(excel_err)}"]
                )

        # If it's a PDF, verify PDF validity
        if lower_fn.endswith(".pdf") or file_bytes.startswith(b"%PDF"):
            try:
                import pypdf
                reader = pypdf.PdfReader(io.BytesIO(file_bytes))
                num_pages = len(reader.pages)
                if num_pages == 0:
                    return QualityCheckResult(
                        is_acceptable=False, quality_score=20, ocr_ready=False,
                        recommendation="Retake — PDF has 0 pages.",
                        metrics={"pages": 0, "fileSizeKb": round(file_size_kb, 1)},
                        issues=["Empty PDF document."]
                    )
                return QualityCheckResult(
                    is_acceptable=True, quality_score=92, ocr_ready=True,
                    recommendation="Accept — Valid vector/scanned PDF document ready for extraction.",
                    metrics={"pages": num_pages, "fileSizeKb": round(file_size_kb, 1), "format": "PDF"},
                    issues=[]
                )
            except Exception as pdf_err:
                return QualityCheckResult(
                    is_acceptable=False, quality_score=15, ocr_ready=False,
                    recommendation="Retake — Corrupted PDF document.",
                    metrics={"fileSizeKb": round(file_size_kb, 1)},
                    issues=[f"Corrupt PDF format: {str(pdf_err)}"]
                )

        return QualityCheckResult(
            is_acceptable=False, quality_score=15, ocr_ready=False,
            recommendation="Retake — Could not decode image.",
            metrics={"fileSizeKb": round(file_size_kb, 1)},
            issues=[f"Image decode error: {str(e)}"]
        )

    # Dimension checks
    if width < 400 or height < 400:
        issues.append(f"Low resolution: {width}x{height}px. Text may be unreadable.")
    
    # Convert to grayscale numpy array for computer vision
    rgb_arr = np.array(pil_img.convert("RGB"))
    
    if HAS_OPENCV:
        gray = cv2.cvtColor(rgb_arr, cv2.COLOR_RGB2GRAY)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        brightness = float(np.mean(gray))
        contrast = float(np.std(gray))
        # Glare ratio: percentage of pixels above 250 brightness
        glare_ratio = float(np.sum(gray >= 250) / (width * height)) * 100.0
    else:
        # Fallback using standard numpy math
        gray = np.dot(rgb_arr[..., :3], [0.2989, 0.5870, 0.1140])
        # Approximate variance of gradients
        gx, gy = np.gradient(gray)
        laplacian_var = float(np.var(gx) + np.var(gy)) * 10.0
        brightness = float(np.mean(gray))
        contrast = float(np.std(gray))
        glare_ratio = float(np.sum(gray >= 250) / (width * height)) * 100.0

    # Sharpness / Blur threshold
    # A standard sharp document usually has Laplacian variance > 80. Blurry images fall below 40.
    is_blurry = laplacian_var < 50.0
    if is_blurry:
        issues.append(f"Image is blurry (sharpness score {round(laplacian_var, 1)}). Hold phone steady and refocus.")

    # Check if this is a high-sharpness digital scan or electronic document (white background paper)
    is_clean_digital_doc = (laplacian_var > 150.0 and contrast >= 8.0)

    # Exposure / Brightness thresholds
    is_too_dark = brightness < 45.0
    is_too_bright = (brightness > 254.9) if is_clean_digital_doc else (brightness > 238.0)
    if is_too_dark:
        issues.append("Image is too dark / underexposed. Enable camera flash or improve lighting.")
    elif is_too_bright:
        issues.append("Image is overexposed / washed out.")

    # Contrast threshold
    is_low_contrast = (contrast < 6.0) if is_clean_digital_doc else (contrast < 25.0)
    if is_low_contrast:
        issues.append("Low contrast between text and background.")

    # Glare threshold
    has_glare = False if is_clean_digital_doc else (glare_ratio > 18.0)
    if has_glare:
        issues.append(f"Significant glare detected ({round(glare_ratio, 1)}% reflection). Angle camera away from light.")

    # Compute overall quality score (0 - 100)
    score = 100
    if is_blurry:
        score -= 35
    if is_too_dark or is_too_bright:
        score -= 25
    if is_low_contrast:
        score -= 15
    if has_glare:
        score -= 20
    if width < 600 or height < 600:
        score -= 10

    score = max(5, min(100, score))
    is_acceptable = score >= 55 and not is_blurry and not is_too_dark
    ocr_ready = score >= 60

    if is_acceptable:
        recommendation = "Accept — Image quality is high and ready for automated OCR extraction."
    else:
        recommendation = "Retake — Quality does not meet forensic verification standards. " + "; ".join(issues)

    metrics = {
        "sharpness": round(float(laplacian_var), 1),
        "brightness": round(float(brightness), 1),
        "contrast": round(float(contrast), 1),
        "glareRatio": round(float(glare_ratio), 1),
        "width": width,
        "height": height,
        "fileSizeKb": round(file_size_kb, 1),
        "format": format_name,
    }

    return QualityCheckResult(
        is_acceptable=is_acceptable,
        quality_score=score,
        ocr_ready=ocr_ready,
        recommendation=recommendation,
        metrics=metrics,
        issues=issues
    )
