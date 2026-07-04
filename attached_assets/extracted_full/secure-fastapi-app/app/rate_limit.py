# -*- coding: utf-8 -*-
"""
app/rate_limit.py
محدِّد معدل الطلبات (نافذة منزلقة، في الذاكرة) — يحافظ على منطقك الأصلي:
  1) Burst لكل IP: يمنع السبام السريع من سكربت واحد.
  2) Backstop يومي لكل IP: يُبطل جدوى الالتفاف بتدوير معرّفات الجهاز.
  3) حصة يومية لكل جهاز (X-Device-Id): ٥ عمليات مجانية يومياً.
ويضيف:
  4) حدوداً على مسارات المصادقة (login/register/refresh) ضد القوة الغاشمة.
  5) تعقيم معرّف الجهاز (طول/محارف) لمنع إغراق الذاكرة بمفاتيح ضخمة.

ملاحظة: المخزن في الذاكرة يعمل لعملية واحدة (مناسب لـ Replit).
للتوسّع الأفقي استبدله بـ Redis بنفس الواجهة.
"""

import re
import threading
import time
from collections import defaultdict, deque

from fastapi import Header, HTTPException, Request, Response, status

# معرّف الجهاز: 8–64 محرفاً من [a-zA-Z0-9._-] فقط
_DEVICE_ID_RE = re.compile(r"^[A-Za-z0-9._-]{8,64}$")


class _SlidingWindowStore:
    """مخزن نافذة منزلقة بسيط وآمن خيطياً (thread-safe)."""

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def hit(self, key: str, limits: list[tuple[int, int]]) -> tuple[bool, int, int]:
        """
        يسجّل محاولة ويتحقق من كل الحدود [(العدد, النافذة بالثواني), ...].
        يُرجّع: (مسموح؟، المتبقي لأطول نافذة، Retry-After بالثواني).
        """
        now = time.monotonic()
        longest = max(w for _, w in limits)
        with self._lock:
            dq = self._hits[key]
            while dq and dq[0] <= now - longest:
                dq.popleft()
            for count, window in limits:
                recent = sum(1 for t in dq if t > now - window)
                if recent >= count:
                    oldest_in_window = next(t for t in dq if t > now - window)
                    retry_after = max(1, int(window - (now - oldest_in_window)) + 1)
                    return False, 0, retry_after
            dq.append(now)
            main_count, main_window = limits[-1]
            used = sum(1 for t in dq if t > now - main_window)
            return True, max(0, main_count - used), 0


_store = _SlidingWindowStore()


def _client_ip(request: Request) -> str:
    # على Replit يمرّ الطلب عبر بروكسي؛ نأخذ أول IP من X-Forwarded-For إن وُجد
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(
    name: str,
    limits: list[tuple[int, int]],
    by: str = "ip",
    message: str | None = None,
    expose_remaining: bool = False,
):
    """
    يُنشئ اعتمادية (Depends) لتحديد المعدل.
    by="ip"     → المفتاح هو عنوان IP.
    by="device" → المفتاح هو X-Device-Id (بعد تعقيمه)، مع تراجع إلى IP.
    """

    async def dependency(
        request: Request,
        response: Response,
        x_device_id: str | None = Header(default=None, alias="X-Device-Id"),
    ) -> None:
        if by == "device":
            if x_device_id and _DEVICE_ID_RE.match(x_device_id):
                ident = f"dev:{x_device_id}"
            else:
                ident = f"ipfallback:{_client_ip(request)}"
        else:
            ident = f"ip:{_client_ip(request)}"

        allowed, remaining, retry_after = _store.hit(f"{name}:{ident}", limits)

        if expose_remaining:
            # نمرّرها عبر request.state ليضيفها وسيط الرؤوس حتى مع الاستثناءات
            request.state.rate_remaining = remaining
            response.headers["X-RateLimit-Remaining"] = str(remaining)

        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=message or "طلبات كثيرة جداً، حاول لاحقاً.",
                headers={"Retry-After": str(retry_after)},
            )

    return dependency
