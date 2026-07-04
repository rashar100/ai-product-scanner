# -*- coding: utf-8 -*-
"""
app/schemas.py
مخططات Pydantic v2 بتحقق صارم على كل المدخلات:
- extra="forbid": يرفض أي حقول غير متوقعة (يمنع mass assignment).
- حدود طول صارمة على كل حقل (يمنع مدخلات ضخمة تستهلك الذاكرة/التكلفة).
- الباركود أرقام فقط، واللغة من قائمة محددة أو رمز ISO قصير.
- صورة base64 يُتحقق من محارفها وحجمها قبل إرسالها إلى Claude.
"""

import base64
import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from .config import get_settings

settings = get_settings()

_LANG_RE = re.compile(r"^(auto|[a-z]{2})$")
_BARCODE_RE = re.compile(r"^\d{6,14}$")
_BASE64_RE = re.compile(r"^[A-Za-z0-9+/=\s]+$")

_UPPER = re.compile(r"[A-Z]")
_LOWER = re.compile(r"[a-z]")
_DIGIT = re.compile(r"\d")
_SPECIAL = re.compile(r"[^A-Za-z0-9]")


def _validate_lang(value: str) -> str:
    v = (value or "auto").strip().lower()
    if not _LANG_RE.match(v):
        raise ValueError("رمز لغة غير صالح — استخدم auto أو رمز ISO من حرفين مثل ar / en")
    return v


# ======================= مخططات المنتجات =======================

class ImageBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    image_base64: str = Field(min_length=100, max_length=settings.MAX_IMAGE_BASE64_CHARS)
    for_barcode: bool = False
    lang: str = "auto"

    @field_validator("lang")
    @classmethod
    def check_lang(cls, v: str) -> str:
        return _validate_lang(v)

    @field_validator("image_base64")
    @classmethod
    def check_base64(cls, v: str) -> str:
        # إزالة بادئة data URL إن وُجدت (data:image/jpeg;base64,...)
        if v.startswith("data:"):
            _, _, v = v.partition(",")
        v = v.strip()
        if not _BASE64_RE.match(v):
            raise ValueError("الصورة ليست بترميز base64 صالح")
        try:
            # تحقق فعلي من صحة الترميز (يفشل مبكراً بدل فشل غامض لاحقاً)
            base64.b64decode(v[:4096], validate=True)
        except Exception:
            raise ValueError("تعذّر فك ترميز base64 للصورة")
        return v


class TextBody(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    query: str = Field(min_length=2, max_length=300)
    lang: str = "auto"

    @field_validator("lang")
    @classmethod
    def check_lang(cls, v: str) -> str:
        return _validate_lang(v)


class BarcodeBody(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    barcode: str
    lang: str = "auto"

    @field_validator("barcode")
    @classmethod
    def check_barcode(cls, v: str) -> str:
        v = v.strip()
        if not _BARCODE_RE.match(v):
            raise ValueError("الباركود يجب أن يكون أرقاماً فقط (6–14 خانة)")
        return v

    @field_validator("lang")
    @classmethod
    def check_lang(cls, v: str) -> str:
        return _validate_lang(v)


class PriceBody(TextBody):
    """نفس تحقق TextBody (استعلام نصي + لغة)."""


# ======================= مخططات المصادقة =======================

def _validate_password_strength(value: str) -> str:
    if not _UPPER.search(value):
        raise ValueError("كلمة المرور تحتاج حرفاً كبيراً واحداً على الأقل")
    if not _LOWER.search(value):
        raise ValueError("كلمة المرور تحتاج حرفاً صغيراً واحداً على الأقل")
    if not _DIGIT.search(value):
        raise ValueError("كلمة المرور تحتاج رقماً واحداً على الأقل")
    if not _SPECIAL.search(value):
        raise ValueError("كلمة المرور تحتاج رمزاً خاصاً واحداً على الأقل")
    return value


class UserRegister(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    email: EmailStr
    password: str = Field(min_length=12, max_length=128)

    @field_validator("password")
    @classmethod
    def check_password(cls, v: str) -> str:
        return _validate_password_strength(v)


class UserLogin(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    """يُرجَع للعميل — لا يحتوي أبداً على كلمة المرور أو تجزئتها."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr
    is_active: bool
    created_at: datetime


class MessageOut(BaseModel):
    detail: str
