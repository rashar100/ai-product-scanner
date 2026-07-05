# -*- coding: utf-8 -*-
"""
app/routers/products.py
مسارات المنتجات — نفس المسارات الخمسة من الإصدار 2 بلا تغيير في السلوك،
مع طبقات الحماية الثلاث (Burst / Backstop / حصة الجهاز) + تحقق صارم من المدخلات.

الحصص:
- زائر (X-Device-Id): DEVICE_DAILY_QUOTA عمليات يومياً (افتراضياً ٥).
- مستخدم مسجَّل الدخول: USER_DAILY_QUOTA (افتراضياً ٢٥) — جاهز لخطة Premium.
"""

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response

from ..claude_client import US_STORE_DOMAINS, ask_claude
from ..prompts import HISTORY_SYSTEM, PRICE_SYSTEM, PRODUCT_SYSTEM
from ..config import get_settings
from ..database import SessionLocal, get_db
from ..dependencies import get_current_user
from ..models import User
from ..quota import DAILY_QUOTA, check_user_quota
from ..rate_limit import rate_limit
from ..schemas import BarcodeBody, ImageBody, PriceBody, TextBody
from ..security import ACCESS_TOKEN_TYPE, TokenError, decode_token
from sqlalchemy.orm import Session
from datetime import date

settings = get_settings()
router = APIRouter(prefix="/api", tags=["products"])

# ── طبقات الحماية (تُطبَّق بالترتيب؛ حصة الجهاز أخيراً لتكون
#    ترويسة X-RateLimit-Remaining معبّرة عن حصة الجهاز تحديداً) ──
_burst = rate_limit("burst", [(settings.IP_BURST_PER_MINUTE, 60)], by="ip")
_backstop = rate_limit("backstop", [(settings.IP_DAILY_BACKSTOP, 86400)], by="ip")
_device_quota = rate_limit(
    "quota", [(settings.DEVICE_DAILY_QUOTA, 86400)], by="device",
    message=f"Daily free limit reached ({settings.DEVICE_DAILY_QUOTA} operations per device).",
    expose_remaining=True,
)
_user_quota = rate_limit(
    "user_quota", [(settings.USER_DAILY_QUOTA, 86400)], by="device",
    message=f"Daily limit reached ({settings.USER_DAILY_QUOTA} operations).",
    expose_remaining=True,
)


def _get_optional_user_id(access_token: str | None) -> str | None:
    """يحاول التعرف على مستخدم مسجَّل دون فرض المصادقة (المسارات عامة)."""
    if not access_token:
        return None
    try:
        payload = decode_token(access_token, ACCESS_TOKEN_TYPE)
    except TokenError:
        return None
    with SessionLocal() as db:
        user = db.get(User, payload["sub"])
        return user.id if user and user.is_active else None


async def apply_quotas(
    request: Request,
    response: Response,
    access_token: str | None = Cookie(default=None),
) -> None:
    """Burst + Backstop للجميع، ثم حصة أعلى للمسجَّلين أو حصة الجهاز للزوار."""
    await _burst(request, response)
    await _backstop(request, response)
    user_id = _get_optional_user_id(access_token)
    if user_id:
        # حصة المستخدم مربوطة بهويته لا بجهازه — نمرّرها كمعرّف عبر الترويسة
        await _user_quota(request, response, x_device_id=f"user.{user_id}"[:64])
    else:
        await _device_quota(
            request, response,
            x_device_id=request.headers.get("X-Device-Id"),
        )


QUOTAS = [Depends(apply_quotas), Depends(check_user_quota)]


# ── المسارات (منطق الإصدار 2 كما هو) ──────────────────────────────

@router.post("/recognize-image", dependencies=QUOTAS)
def recognize_image(body: ImageBody):
    """التعرّف من صورة (Sonnet للرؤية الدقيقة). قراءة الباركود تفعّل البحث."""
    prompt = (
        "اقرأ أرقام الباركود في الصورة، ثم ابحث عن المنتج المطابق وأعِد بيانات JSON."
        if body.for_barcode
        else "تعرّف على المنتج الظاهر في هذه الصورة وأعِد بيانات JSON."
    )
    content = [
        {"type": "image", "source": {
            "type": "base64", "media_type": "image/jpeg",
            "data": body.image_base64}},
        {"type": "text", "text": prompt},
    ]
    return ask_claude(content, PRODUCT_SYSTEM, body.lang, settings.MODEL_VISION,
                      use_search=body.for_barcode, max_uses=3, has_image=True)


@router.post("/recognize-text", dependencies=QUOTAS)
def recognize_text(body: TextBody):
    """البحث بالنص بأي لغة (Haiku السريع)."""
    content = [{"type": "text",
                "text": f"ابحث عن هذا المنتج وأعِد بيانات JSON: {body.query}"}]
    return ask_claude(content, PRODUCT_SYSTEM, body.lang, settings.MODEL_FAST,
                      use_search=True, max_uses=3)


@router.post("/recognize-barcode", dependencies=QUOTAS)
def recognize_barcode(body: BarcodeBody):
    """البحث برقم الباركود (Haiku السريع)."""
    content = [{"type": "text",
                "text": f"ابحث عن المنتج صاحب رقم الباركود التالي وأعِد بيانات JSON: {body.barcode}"}]
    return ask_claude(content, PRODUCT_SYSTEM, body.lang, settings.MODEL_FAST,
                      use_search=True, max_uses=3)


@router.post("/prices", dependencies=QUOTAS)
def prices(body: PriceBody):
    """مقارنة الأسعار في متاجر أمريكا (مقيّدة بنطاقاتها)."""
    content = [{"type": "text",
                "text": f"ابحث عن أسعار هذا المنتج وأعِد JSON: {body.query}"}]
    return ask_claude(content, PRICE_SYSTEM, body.lang, settings.MODEL_PRICES,
                      use_search=True, max_tokens=2000,
                      allowed_domains=US_STORE_DOMAINS, max_uses=4)


@router.post("/price-history", dependencies=QUOTAS)
def price_history(body: PriceBody):
    """سجلّ السعر التقديري لآخر ٦ أشهر (بحث حر في مواقع تتبّع الأسعار)."""
    content = [{"type": "text",
                "text": f"ابحث عن تاريخ سعر هذا المنتج في آخر ٦ أشهر وأعِد JSON: {body.query}"}]
    return ask_claude(content, HISTORY_SYSTEM, body.lang, settings.MODEL_PRICES,
                      use_search=True, max_tokens=1500, max_uses=4)


@router.get("/quota")
def get_quota(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """يرجع عدد عمليات البحث المتبقية لليوم للمستخدم الحالي."""
    today = date.today()
    if current_user.last_quota_reset < today:
        current_user.daily_searches_remaining = DAILY_QUOTA
        current_user.last_quota_reset = today
        db.commit()
    return {
        "remaining": current_user.daily_searches_remaining,
        "daily_limit": DAILY_QUOTA,
        "reset_at": "midnight UTC",
    }


@router.get("/healthz")
def healthz():
    return {"status": "ok"}
