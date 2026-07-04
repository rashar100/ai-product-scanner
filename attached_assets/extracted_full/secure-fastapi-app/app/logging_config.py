"""
app/logging_config.py
إعداد تسجيل (logging) آمن:
- يُخفي (redacts) أي كلمات مرور أو توكنات أو رؤوس Authorization/Cookie
  قد تظهر بالخطأ في نص السجل، قبل كتابته.
- لا نُسجّل أبداً الجسم الكامل لطلبات تسجيل الدخول/التسجيل.
"""

import logging
import re
import sys

_REDACT_PATTERNS = [
    (re.compile(r'("?password"?\s*[:=]\s*)"[^"]*"', re.IGNORECASE), r'\1"***REDACTED***"'),
    (re.compile(r'(Authorization:\s*Bearer\s+)\S+', re.IGNORECASE), r'\1***REDACTED***'),
    (re.compile(r'(access_token=)[^;\s]+', re.IGNORECASE), r'\1***REDACTED***'),
    (re.compile(r'(refresh_token=)[^;\s]+', re.IGNORECASE), r'\1***REDACTED***'),
    (re.compile(r'(Cookie:\s*)[^\n]+', re.IGNORECASE), r'\1***REDACTED***'),
]


class RedactingFilter(logging.Filter):
    """مرشّح يستبدل أي بيانات حساسة قبل كتابة السجل."""

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            message = record.getMessage()
        except Exception:
            return True
        redacted = message
        for pattern, replacement in _REDACT_PATTERNS:
            redacted = pattern.sub(replacement, redacted)
        if redacted != message:
            record.msg = redacted
            record.args = ()
        return True


def configure_logging(debug: bool = False) -> None:
    level = logging.DEBUG if debug else logging.INFO
    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(RedactingFilter())
    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)s | %(name)s | %(message)s"
    )
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.setLevel(level)
    root.handlers.clear()
    root.addHandler(handler)

    # قلّل ضوضاء مكتبات خارجية، وامنع تسجيل معلومات SQL الحساسة
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("passlib").setLevel(logging.WARNING)
