"""
app/middleware.py
وسيط (middleware) يضيف رؤوس أمان HTTP لكل استجابة:
- Content-Security-Policy: يمنع XSS عبر تقييد مصادر السكربتات.
- Strict-Transport-Security: يجبر المتصفح على استخدام HTTPS فقط.
- X-Frame-Options: يمنع النقر-الخادع (clickjacking).
- X-Content-Type-Options: يمنع المتصفح من "تخمين" نوع المحتوى.
- Referrer-Policy: يقلل تسرّب معلومات في رأس Referer.
- Permissions-Policy: يعطّل ميزات المتصفح غير المستخدمة.
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from .config import get_settings

settings = get_settings()


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        # ترويسة الحصة المتبقية (تصمد حتى لو انتهى الطلب باستثناء)
        remaining = getattr(request.state, "rate_remaining", None)
        if remaining is not None:
            response.headers["X-RateLimit-Remaining"] = str(remaining)

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "geolocation=(), microphone=(), camera=(), payment=()"
        )
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; "
            "object-src 'none'; "
            "base-uri 'self'; "
            "frame-ancestors 'none'"
        )
        # HSTS فقط عبر HTTPS في الإنتاج (لا فائدة منه على HTTP محلياً)
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains; preload"
            )
        # منع تخزين استجابات حساسة في الكاش
        if request.url.path.startswith("/auth"):
            response.headers["Cache-Control"] = "no-store"

        return response
