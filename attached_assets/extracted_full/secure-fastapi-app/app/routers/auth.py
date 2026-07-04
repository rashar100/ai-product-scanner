# -*- coding: utf-8 -*-
"""
app/routers/auth.py
مسارات المصادقة:
- /auth/register : إنشاء حساب (تجزئة bcrypt، رسالة موحّدة لمنع تعداد البريد).
- /auth/login    : يُصدر access + refresh في كوكيز HTTPOnly + كوكي CSRF قابل للقراءة.
- /auth/refresh  : تدوير توكن التحديث (rotation) — القديم يُبطَل فوراً.
- /auth/logout   : يُبطل توكن التحديث ويمسح الكوكيز (محمي بـ CSRF).
- /auth/me       : بيانات المستخدم الحالي.
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..dependencies import get_current_user, verify_csrf
from ..models import RefreshToken, User
from ..rate_limit import rate_limit
from ..schemas import MessageOut, UserLogin, UserOut, UserRegister
from ..security import (
    REFRESH_TOKEN_TYPE,
    TokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_csrf_token,
    hash_password,
    verify_password,
)

logger = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter(prefix="/auth", tags=["auth"])

# رسالة موحّدة — لا نكشف إن كان البريد موجوداً أم كلمة المرور خاطئة
_BAD_CREDENTIALS = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="البريد الإلكتروني أو كلمة المرور غير صحيحة",
)


def _set_auth_cookies(response: Response, access: str, refresh: str) -> str:
    """يضبط كوكيز المصادقة الآمنة ويُرجّع توكن CSRF الجديد."""
    common = {
        "httponly": True,
        "secure": settings.COOKIE_SECURE,
        "samesite": settings.COOKIE_SAMESITE,
    }
    response.set_cookie(
        "access_token", access,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/", **common,
    )
    # توكن التحديث يُرسَل فقط لمسارات /auth (يقلّل سطح التعرض)
    response.set_cookie(
        "refresh_token", refresh,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/auth", **common,
    )
    # كوكي CSRF: غير HTTPOnly عمداً — الواجهة تقرؤه وترسله في X-CSRF-Token
    csrf = generate_csrf_token()
    response.set_cookie(
        "csrf_token", csrf,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/", httponly=False,
        secure=settings.COOKIE_SECURE, samesite=settings.COOKIE_SAMESITE,
    )
    return csrf


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/auth")
    response.delete_cookie("csrf_token", path="/")


def _issue_tokens(response: Response, db: Session, user: User) -> None:
    access, _, _ = create_access_token(user.id)
    refresh, jti, expires_at = create_refresh_token(user.id)
    db.add(RefreshToken(jti=jti, user_id=user.id, expires_at=expires_at))
    db.commit()
    _set_auth_cookies(response, access, refresh)


@router.post(
    "/register",
    response_model=MessageOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit(
        "auth_register", [(get_settings().AUTH_REGISTER_PER_MINUTE, 60)], by="ip",
        message="محاولات تسجيل كثيرة، انتظر دقيقة."))],
)
def register(body: UserRegister, db: Session = Depends(get_db)):
    exists = db.scalar(select(User).where(User.email == body.email.lower()))
    if exists:
        # 200-مثل الرسالة الموحّدة يمنع تعداد البريد، لكن 409 صريح أوضح للواجهة.
        # نختار رسالة عامة بدون تأكيد وجود الحساب:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="تعذّر إنشاء الحساب بهذه البيانات",
        )
    user = User(email=body.email.lower(), hashed_password=hash_password(body.password))
    db.add(user)
    db.commit()
    logger.info("New user registered: id=%s", user.id)  # لا نسجّل البريد
    return MessageOut(detail="تم إنشاء الحساب بنجاح")


@router.post(
    "/login",
    response_model=UserOut,
    dependencies=[Depends(rate_limit(
        "auth_login", [(get_settings().AUTH_LOGIN_PER_MINUTE, 60)], by="ip",
        message="محاولات دخول كثيرة، انتظر دقيقة."))],
)
def login(body: UserLogin, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    # نتحقق دائماً من كلمة المرور (حتى لو لم يوجد المستخدم) لتوحيد زمن الاستجابة
    dummy_hash = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO6abcdefghijklmnopqrstuvwx1234567"
    valid = verify_password(body.password, user.hashed_password if user else dummy_hash)
    if not user or not valid or not user.is_active:
        raise _BAD_CREDENTIALS
    _issue_tokens(response, db, user)
    logger.info("User logged in: id=%s", user.id)
    return user


@router.post(
    "/refresh",
    response_model=MessageOut,
    dependencies=[Depends(rate_limit(
        "auth_refresh", [(get_settings().AUTH_REFRESH_PER_MINUTE, 60)], by="ip"))],
)
def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
):
    """تدوير التوكن: يُبطل القديم ويُصدر زوجاً جديداً."""
    if not refresh_token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "لا يوجد توكن تحديث")
    try:
        payload = decode_token(refresh_token, REFRESH_TOKEN_TYPE)
    except TokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "توكن التحديث غير صالح")

    record = db.scalar(select(RefreshToken).where(RefreshToken.jti == payload["jti"]))
    now = datetime.now(timezone.utc)
    if (
        record is None
        or record.revoked
        or record.expires_at.replace(tzinfo=timezone.utc) < now
    ):
        # إعادة استخدام توكن مُبطَل = مؤشر سرقة → نُبطل كل جلسات المستخدم
        if record is not None and record.revoked:
            logger.warning("Refresh token reuse detected: user=%s", record.user_id)
            for t in db.scalars(select(RefreshToken).where(
                    RefreshToken.user_id == record.user_id)):
                t.revoked = True
            db.commit()
        _clear_auth_cookies(response)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "توكن التحديث غير صالح")

    user = db.get(User, record.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "الحساب غير متاح")

    record.revoked = True  # تدوير: القديم يُبطَل فوراً
    _issue_tokens(response, db, user)
    return MessageOut(detail="تم تحديث الجلسة")


@router.post(
    "/logout",
    response_model=MessageOut,
    dependencies=[Depends(verify_csrf)],
)
def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
):
    if refresh_token:
        try:
            payload = decode_token(refresh_token, REFRESH_TOKEN_TYPE)
            record = db.scalar(
                select(RefreshToken).where(RefreshToken.jti == payload["jti"]))
            if record:
                record.revoked = True
                db.commit()
        except TokenError:
            pass  # الكوكي تالف — نكتفي بمسحه
    _clear_auth_cookies(response)
    return MessageOut(detail="تم تسجيل الخروج")


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user
