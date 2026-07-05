# -*- coding: utf-8 -*-
"""
app/quota.py
نظام حصة البحث اليومية للمستخدمين المسجلين.
- المسجلون: 5 عمليات/يوم مُتتبَّعة في قاعدة البيانات، تُعاد يومياً.
- الزوار: تُعالَج بواسطة rate_limit في apply_quotas (لا تعديل هنا).
"""

from datetime import date

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from .models import User
from .security import ACCESS_TOKEN_TYPE, TokenError, decode_token

DAILY_QUOTA = 5


def check_user_quota(
    access_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> None:
    """
    اعتمادية اختيارية: إن لم يكن المستخدم مسجَّلاً تُكمل بدون تأثير.
    إن كان مسجَّلاً تتحقق من رصيده وتنقصه، أو ترجع 429 إن استنفده.
    """
    if not access_token:
        return  # زائر — تُعالَج حصته بواسطة _device_quota في apply_quotas

    try:
        payload = decode_token(access_token, ACCESS_TOKEN_TYPE)
    except TokenError:
        return  # توكن غير صالح — نتعامل معه كزائر

    user = db.get(User, payload["sub"])
    if not user or not user.is_active:
        return

    today = date.today()

    # إعادة تعيين الرصيد إذا بدأ يوم جديد
    if user.last_quota_reset < today:
        user.daily_searches_remaining = DAILY_QUOTA
        user.last_quota_reset = today
        db.commit()

    if user.daily_searches_remaining <= 0:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"لقد استنفذت الحد اليومي ({DAILY_QUOTA} عمليات بحث). حاول غداً.",
        )

    user.daily_searches_remaining -= 1
    db.commit()
