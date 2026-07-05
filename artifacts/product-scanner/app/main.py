# -*- coding: utf-8 -*-
"""
app/main.py — نقطة الدخول
خادم "مُعرّف المنتجات" — الإصدار 3 (الآمن)

يجمع كل الطبقات:
- تسجيل آمن (يحجب كلمات المرور والتوكنات).
- رؤوس أمان HTTP على كل استجابة.
- CORS مقيّد بنطاقات من الإعدادات (لا "*" بعد اليوم).
- معالج أخطاء عام لا يسرّب أي تفاصيل داخلية.
- مسارات المصادقة + مسارات المنتجات الأصلية.
"""

import logging

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .database import Base, engine, run_migrations
from .logging_config import configure_logging
from .middleware import SecurityHeadersMiddleware
from .routers import auth, products

settings = get_settings()
configure_logging(debug=settings.DEBUG)
logger = logging.getLogger(__name__)

# إنشاء الجداول (للتطبيقات الأكبر استخدم Alembic للهجرات)
Base.metadata.create_all(bind=engine)
# ترقيات آمنة للأعمدة الجديدة على قواعد البيانات الموجودة
run_migrations()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    # في الإنتاج نخفي صفحات التوثيق التفاعلية (تقليل سطح الاستكشاف)
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None,
    openapi_url=None if settings.is_production else "/openapi.json",
)

# ── الوسطاء (الترتيب مهم: الأمان أولاً) ───────────────────────────
app.add_middleware(SecurityHeadersMiddleware)

if settings.cors_origins_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,  # نطاقات محددة فقط
        allow_credentials=True,                    # ضروري للكوكيز
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "X-Device-Id", "X-CSRF-Token"],
        expose_headers=["X-RateLimit-Remaining", "Retry-After"],
    )

# ── معالج أخطاء عام: لا تسريب لأي تفاصيل داخلية ───────────────────
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "حدث خطأ داخلي، حاول مرة أخرى لاحقاً."},
    )


# ── المسارات ──────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(products.router)


@app.get("/")
def health():
    """فحص الصحة — لا يكشف حالة المفاتيح ولا أسماء النماذج (كما كان سابقاً)."""
    return {"status": "ok", "version": settings.APP_VERSION}


if __name__ == "__main__":
    import os

    import uvicorn

    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port)
