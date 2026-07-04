# -*- coding: utf-8 -*-
"""
app/config.py
كل الإعدادات والأسرار تُقرأ من متغيرات البيئة (Replit Secrets في الإنتاج،
وملف .env محلياً). لا يوجد أي سر مكتوب داخل الكود.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # --- عام ---
    APP_NAME: str = "Product Scanner API"
    APP_VERSION: str = "3.0"
    ENVIRONMENT: str = "development"  # development | production
    DEBUG: bool = False

    # --- الأسرار (إجبارية — يفشل الإقلاع بدونها، وهذا مقصود) ---
    SECRET_KEY: str                 # لتوقيع JWT — أنشئه بـ: python -c "import secrets; print(secrets.token_urlsafe(64))"
    ANTHROPIC_API_KEY: str          # مفتاح Anthropic API

    # --- JWT ---
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # --- قاعدة البيانات ---
    DATABASE_URL: str = "sqlite:///./app.db"

    # --- الكوكيز ---
    COOKIE_SECURE: bool = True      # اجعله false محلياً فقط (HTTP)
    COOKIE_SAMESITE: str = "strict"

    # --- CORS: نطاقات مسموحة مفصولة بفاصلة (فارغة = لا يُسمح لأي نطاق خارجي) ---
    CORS_ORIGINS: str = ""

    # --- نماذج Claude (توجيه: سرعة × دقة) ---
    MODEL_FAST: str = "claude-haiku-4-5-20251001"
    MODEL_VISION: str = "claude-sonnet-4-6"
    MODEL_PRICES: str = "claude-sonnet-4-6"

    # --- الحصص (Freemium) ---
    DEVICE_DAILY_QUOTA: int = 5        # عمليات لكل جهاز يومياً (مجاني)
    USER_DAILY_QUOTA: int = 25         # عمليات لكل مستخدم مسجَّل يومياً
    IP_BURST_PER_MINUTE: int = 8       # منع السبام السريع
    IP_DAILY_BACKSTOP: int = 25        # سقف يومي لكل IP (يمنع تدوير معرّفات الجهاز)

    # --- حدود المصادقة ---
    AUTH_LOGIN_PER_MINUTE: int = 5
    AUTH_REGISTER_PER_MINUTE: int = 3
    AUTH_REFRESH_PER_MINUTE: int = 10

    # --- حدود المدخلات ---
    MAX_IMAGE_BASE64_CHARS: int = 7_000_000   # ≈ صورة 5MB بعد ترميز base64

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.strip().lower() == "production"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
