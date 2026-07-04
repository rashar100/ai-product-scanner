# -*- coding: utf-8 -*-
"""
app/claude_client.py
الاستدعاء الموحّد لـ Claude (منقول من الإصدار 2) مع تحسينات أمنية:
- المفتاح من الإعدادات (Replit Secrets / .env) — لا يُطبع ولا يُسجَّل أبداً.
- معالجة أخطاء لا تسرّب تفاصيل داخلية للعميل:
  التفاصيل الكاملة تُسجَّل خادمياً فقط، والعميل يرى رسالة عامة.
- Prompt Caching على المطالبات الثابتة كما في الأصل.
"""

import json
import logging
from typing import List, Optional

from anthropic import Anthropic
from fastapi import HTTPException, status

from .config import get_settings
from .prompts import lang_note

logger = logging.getLogger(__name__)
settings = get_settings()

client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)

# نطاقات المتاجر الأمريكية — بحث الأسعار مقيّد بها
US_STORE_DOMAINS = [
    "amazon.com", "ebay.com", "walmart.com",
    "bestbuy.com", "target.com", "newegg.com",
]

_UPSTREAM_ERROR = HTTPException(
    status_code=status.HTTP_502_BAD_GATEWAY,
    detail="تعذّر الحصول على نتيجة من خدمة الذكاء الاصطناعي، حاول مرة أخرى.",
)


def extract_json(text: str):
    """يستخرج أوّل كائن JSON متوازن من نهاية نصّ النموذج."""
    for i in range(len(text) - 1, -1, -1):
        if text[i] != "}":
            continue
        depth = 0
        for j in range(i, -1, -1):
            if text[j] == "}":
                depth += 1
            elif text[j] == "{":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[j:i + 1])
                    except json.JSONDecodeError:
                        break
    return None


def ask_claude(
    content,
    system_static: str,
    lang: str,
    model: str,
    use_search: bool = False,
    max_tokens: int = 1200,
    allowed_domains: Optional[List[str]] = None,
    max_uses: int = 3,
    has_image: bool = False,
):
    """يبني الطلب مع Caching وتعليمة اللغة، يستدعي Claude، ويعيد JSON."""
    system_blocks = [
        {"type": "text", "text": system_static,
         "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": lang_note(lang, has_image)},
    ]

    kwargs = {
        "model": model,
        "max_tokens": max_tokens,
        "system": system_blocks,
        "messages": [{"role": "user", "content": content}],
    }

    if use_search:
        tool = {"type": "web_search_20250305", "name": "web_search",
                "max_uses": max_uses}
        if allowed_domains:
            tool["allowed_domains"] = allowed_domains
        kwargs["tools"] = [tool]

    try:
        msg = client.messages.create(**kwargs)
    except Exception:
        # التفاصيل خادمياً فقط — العميل يرى رسالة عامة (لا تسريب لبنية النظام)
        logger.exception("Claude API request failed (model=%s)", model)
        raise _UPSTREAM_ERROR

    text = "".join(
        getattr(b, "text", "") for b in msg.content
        if getattr(b, "type", "") == "text"
    )
    data = extract_json(text)
    if data is None:
        # لا نُعيد نص النموذج الخام للعميل (كان يُعاد في الإصدار السابق)
        logger.warning("No valid JSON in model response (model=%s, len=%d)",
                       model, len(text))
        raise _UPSTREAM_ERROR
    return data
