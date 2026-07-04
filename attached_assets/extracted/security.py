"""
app/security.py
منطق الأمان الأساسي:
- تجزئة كلمات المرور عبر passlib[bcrypt].
- إنشاء والتحقق من توكنات JWT (access + refresh).
- توليد توكن CSRF.
"""

import secrets
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from passlib.context import CryptContext

from .config import get_settings

settings = get_settings()

# سياق التجزئة — bcrypt هو المعيار الآمن الموصى به
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"


class TokenError(Exception):
    """خطأ عام للتوكن غير الصالح أو المنتهي."""


# ------------------------- كلمات المرور -------------------------
def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


# ------------------------- توكنات JWT -------------------------
def _create_token(
    subject: str, token_type: str, expires_delta: timedelta
) -> tuple[str, str, datetime]:
    """يُنشئ توكناً موقّعاً ويُرجّع (التوكن، jti، وقت الانتهاء)."""
    now = datetime.now(timezone.utc)
    expire = now + expires_delta
    jti = str(uuid.uuid4())
    payload = {
        "sub": subject,
        "type": token_type,
        "jti": jti,
        "iat": now,
        "exp": expire,
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return token, jti, expire


def create_access_token(subject: str) -> tuple[str, str, datetime]:
    return _create_token(
        subject,
        ACCESS_TOKEN_TYPE,
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(subject: str) -> tuple[str, str, datetime]:
    return _create_token(
        subject,
        REFRESH_TOKEN_TYPE,
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


def decode_token(token: str, expected_type: str) -> dict:
    """يفكّ التوكن ويتحقق من توقيعه، انتهائه، ونوعه."""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except jwt.ExpiredSignatureError as exc:
        raise TokenError("انتهت صلاحية التوكن") from exc
    except jwt.InvalidTokenError as exc:
        raise TokenError("توكن غير صالح") from exc

    if payload.get("type") != expected_type:
        raise TokenError("نوع التوكن غير متوقع")
    if not payload.get("sub"):
        raise TokenError("التوكن لا يحتوي على معرّف مستخدم")
    return payload


# ------------------------- CSRF -------------------------
def generate_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def csrf_tokens_match(a: str | None, b: str | None) -> bool:
    if not a or not b:
        return False
    # مقارنة ثابتة الزمن لمنع هجمات التوقيت
    return secrets.compare_digest(a, b)
