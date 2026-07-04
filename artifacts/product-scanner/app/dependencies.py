"""
app/dependencies.py
اعتماديات (dependencies) المصادقة:
- get_current_user: يقرأ access token من كوكي HTTPOnly ويتحقق منه.
- verify_csrf: يتحقق من تطابق توكن CSRF بين الكوكي ورأس الطلب
  (نمط Double Submit Cookie) لأي طلب يغيّر حالة (POST/PUT/DELETE).
"""

from fastapi import Cookie, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from .models import User
from .security import ACCESS_TOKEN_TYPE, TokenError, csrf_tokens_match, decode_token

CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="بيانات الاعتماد غير صالحة أو منتهية الصلاحية",
)


def get_current_user(
    access_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> User:
    """يستخرج المستخدم الحالي من توكن الوصول المخزّن في كوكي HTTPOnly."""
    if not access_token:
        raise CREDENTIALS_EXCEPTION
    try:
        payload = decode_token(access_token, ACCESS_TOKEN_TYPE)
    except TokenError:
        raise CREDENTIALS_EXCEPTION

    user = db.get(User, payload["sub"])
    if user is None or not user.is_active:
        raise CREDENTIALS_EXCEPTION
    return user


def verify_csrf(
    csrf_token_cookie: str | None = Cookie(default=None, alias="csrf_token"),
    x_csrf_token: str | None = Header(default=None, alias="X-CSRF-Token"),
) -> None:
    """
    نمط Double Submit Cookie: العميل (JS) يقرأ قيمة كوكي csrf_token
    (غير HTTPOnly) ويرسلها في رأس X-CSRF-Token. مهاجم CSRF من موقع آخر
    لا يستطيع قراءة الكوكي، لذا لا يمكنه إرسال الرأس المطابق.
    """
    if not csrf_tokens_match(csrf_token_cookie, x_csrf_token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="فشل التحقق من CSRF",
        )
