"""
app/database.py
إعداد اتصال قاعدة البيانات باستخدام SQLAlchemy 2.x (ORM).
استخدام ORM هو أول خط دفاع ضد حقن SQL (SQL Injection) لأنه يستعمل
استعلامات مُعاملة (parameterized queries) تلقائياً.
"""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings

settings = get_settings()

# SQLite يحتاج check_same_thread=False مع خوادم متعددة الخيوط
connect_args = (
    {"check_same_thread": False}
    if settings.DATABASE_URL.startswith("sqlite")
    else {}
)

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,  # يتحقق من صلاحية الاتصال قبل الاستخدام
    echo=False,          # لا تطبع الاستعلامات (قد تسرّب بيانات في السجلات)
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    """الأساس المشترك لكل النماذج (Models)."""
    pass


def run_migrations() -> None:
    """
    ترقيات بسيطة للمخطط: تضيف الأعمدة الجديدة إن لم تكن موجودة.
    آمنة تماماً على قواعد البيانات الموجودة (لا تحذف بيانات).
    """
    from sqlalchemy import inspect, text

    with engine.connect() as conn:
        inspector = inspect(engine)
        existing = {c["name"] for c in inspector.get_columns("users")}
        if "daily_searches_remaining" not in existing:
            conn.execute(
                text(
                    "ALTER TABLE users ADD COLUMN"
                    " daily_searches_remaining INTEGER NOT NULL DEFAULT 5"
                )
            )
            conn.commit()
        if "last_quota_reset" not in existing:
            conn.execute(
                text(
                    "ALTER TABLE users ADD COLUMN"
                    " last_quota_reset DATE NOT NULL DEFAULT (date('now'))"
                )
            )
            conn.commit()


def get_db() -> Generator[Session, None, None]:
    """اعتمادية (dependency) تُعطي جلسة قاعدة بيانات وتغلقها تلقائياً."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
