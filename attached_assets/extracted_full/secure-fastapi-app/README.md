# 🛍️ Product Scanner API — v3 (Secure Edition)

خادم FastAPI للتعرّف على المنتجات (صورة / باركود / نص) ومقارنة الأسعار وتاريخها في المتاجر الأمريكية، مبني على Claude API — مع طبقة أمان كاملة جاهزة للإنتاج.

An API for product recognition (image / barcode / text), US price comparison, and 6-month price history — powered by Claude, hardened for production.

---

## ✨ المميزات

**الوظائف (من الإصدار 2 — كما هي):**
التعرّف على المنتجات من الصور عبر Claude Vision، قراءة الباركود والبحث عنه، البحث النصي بأي لغة (`lang=auto` يردّ بلغة الاستعلام)، مقارنة الأسعار في Amazon/eBay/Walmart/Best Buy/Target/Newegg، سجلّ أسعار ٦ أشهر مع نصيحة شراء، توجيه النماذج (Haiku للسرعة، Sonnet للدقة) وPrompt Caching لتقليل التكلفة.

**الأمان (جديد في الإصدار 3):**
مصادقة JWT بكوكيز HTTPOnly مع تدوير توكن التحديث، تجزئة كلمات المرور بـ bcrypt، حماية CSRF بنمط Double Submit Cookie، رؤوس أمان كاملة (CSP/HSTS/X-Frame-Options…)، تحقق Pydantic v2 صارم على كل المدخلات، تحديد معدل متعدد الطبقات، تسجيل آمن يحجب الأسرار، ومعالجة أخطاء لا تسرّب أي تفاصيل داخلية.

---

## 📁 هيكل المشروع

```
secure-fastapi-app/
├── app/
│   ├── main.py              # نقطة الدخول: الوسطاء، المعالجات، المسارات
│   ├── config.py            # الإعدادات — كل الأسرار من البيئة
│   ├── database.py          # SQLAlchemy 2 (ORM = حماية من SQL Injection)
│   ├── models.py            # User + RefreshToken (لإبطال/تدوير التوكنات)
│   ├── schemas.py           # تحقق Pydantic v2 صارم على كل المدخلات
│   ├── security.py          # bcrypt + JWT + CSRF
│   ├── dependencies.py      # المستخدم الحالي من الكوكي + تحقق CSRF
│   ├── middleware.py        # رؤوس الأمان HTTP
│   ├── rate_limit.py        # نافذة منزلقة: Burst/Backstop/حصة الجهاز/حدود المصادقة
│   ├── logging_config.py    # تسجيل يحجب كلمات المرور والتوكنات تلقائياً
│   ├── claude_client.py     # استدعاء Claude الموحّد + معالجة أخطاء آمنة
│   ├── prompts.py           # مطالبات النظام الثابتة (مع Prompt Caching)
│   └── routers/
│       ├── auth.py          # /auth: register, login, refresh, logout, me
│       └── products.py      # /api: المسارات الخمسة الأصلية
├── requirements.txt
├── .env.example             # قالب المتغيرات — انسخه إلى .env
├── .gitignore
├── .replit
└── README.md
```

---

## 🚀 التشغيل على Replit

1. أنشئ Repl جديداً (Python) وارفع الملفات، أو استورد المستودع من GitHub مباشرة (Import from GitHub).
2. افتح تبويب **Secrets** (أيقونة القفل 🔒) وأضِف:

   | Key | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | مفتاحك من console.anthropic.com |
   | `SECRET_KEY` | ناتج الأمر أدناه |
   | `ENVIRONMENT` | `production` |
   | `COOKIE_SECURE` | `true` |
   | `CORS_ORIGINS` | نطاق واجهتك، مثل `https://myapp.example.com` |

   لتوليد `SECRET_KEY` شغّل في Shell:
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(64))"
   ```

3. في Shell:
   ```bash
   pip install -r requirements.txt
   ```
4. اضغط **Run** — ملف `.replit` يشغّل `uvicorn app.main:app` تلقائياً على المنفذ 8080.
5. تحقق: افتح `/` يجب أن ترى `{"status":"ok","version":"3.0"}`.

> ملاحظة: Replit يقرأ Secrets كمتغيرات بيئة تلقائياً — لا تحتاج ملف `.env` هناك.

## 💻 التشغيل محلياً

```bash
git clone https://github.com/USERNAME/product-scanner-api.git
cd product-scanner-api
python -m venv .venv && source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env      # ثم املأ SECRET_KEY و ANTHROPIC_API_KEY
uvicorn app.main:app --reload --port 8080
```

صفحات التوثيق التفاعلية متاحة على `http://localhost:8080/docs` (تُخفى تلقائياً في الإنتاج).

## 📤 الرفع إلى GitHub

```bash
git init
git add .
git commit -m "v3: production-ready secure refactor"
git branch -M main
git remote add origin https://github.com/USERNAME/product-scanner-api.git
git push -u origin main
```

قبل أول push تأكد أن `git status` **لا** يعرض `.env` أو `app.db` (كلاهما في `.gitignore`).

---

## 🔌 المسارات

### المنتجات (عامة، بحصص)
كل الطلبات ترسل ترويسة `X-Device-Id` (معرّف 8–64 محرفاً تولّده الواجهة وتخزّنه).

| Method | Path | Body |
|---|---|---|
| POST | `/api/recognize-image` | `{ image_base64, for_barcode?, lang? }` |
| POST | `/api/recognize-text` | `{ query, lang? }` |
| POST | `/api/recognize-barcode` | `{ barcode, lang? }` |
| POST | `/api/prices` | `{ query, lang? }` |
| POST | `/api/price-history` | `{ query, lang? }` |

الحصص: زائر = **5 عمليات/يوم لكل جهاز**، مستخدم مسجَّل = **25/يوم** (قابلة للتعديل من البيئة — جاهزة لخطة Premium). المتبقي يظهر في ترويسة `X-RateLimit-Remaining`، وعند التجاوز تعود `429` مع `Retry-After`.

### المصادقة
| Method | Path | ملاحظات |
|---|---|---|
| POST | `/auth/register` | `{ email, password }` — كلمة مرور ≥ 12 محرفاً وقوية |
| POST | `/auth/login` | يضبط كوكيز `access_token` + `refresh_token` (HTTPOnly) + `csrf_token` |
| POST | `/auth/refresh` | يدوّر توكن التحديث (القديم يُبطَل) |
| POST | `/auth/logout` | يتطلب ترويسة `X-CSRF-Token` مطابقة لكوكي `csrf_token` |
| GET | `/auth/me` | بيانات المستخدم الحالي |

مثال استخدام من الواجهة (بعد تسجيل الدخول تُرسَل الكوكيز تلقائياً مع `credentials: "include"`):

```js
const csrf = document.cookie.match(/csrf_token=([^;]+)/)?.[1];
await fetch("/auth/logout", {
  method: "POST",
  credentials: "include",
  headers: { "X-CSRF-Token": csrf },
});
```

---

## 🔐 ملخص القرارات الأمنية

- **الأسرار:** يفشل الإقلاع عمداً إن غاب `SECRET_KEY` أو `ANTHROPIC_API_KEY` — لا قيم افتراضية ضعيفة.
- **JWT في كوكيز HTTPOnly:** جافاسكربت لا يستطيع قراءتها → سرقة التوكن عبر XSS غير ممكنة. `SameSite=strict` + `Secure` في الإنتاج.
- **تدوير توكن التحديث:** كل تحديث يُبطل التوكن السابق؛ وإعادة استخدام توكن مُبطَل تُعتبر مؤشر اختراق فتُبطَل كل جلسات المستخدم فوراً.
- **CSRF:** نمط Double Submit Cookie على العمليات الحساسة.
- **SQL Injection:** SQLAlchemy ORM باستعلامات مُعاملة حصراً — لا نص SQL مركّب يدوياً.
- **XSS:** الـ API يعيد JSON فقط + رأس CSP صارم + `X-Content-Type-Options: nosniff`.
- **تعداد الحسابات:** رسائل موحّدة في login/register + مقارنة bcrypt دائماً لتوحيد زمن الاستجابة.
- **التسجيل:** مرشّح يحجب أي password/token/Authorization/Cookie قبل الكتابة؛ لا يُسجَّل بريد المستخدمين.
- **الأخطاء:** العميل يرى رسائل عامة فقط؛ التفاصيل الكاملة في سجلات الخادم.

## 🗺️ خطوات تالية مقترحة

عند نمو المشروع: استبدل مخزن الحصص في الذاكرة بـ **Redis** (يصمد مع إعادة التشغيل وعدة عمليات)، أضِف **Alembic** لهجرات قاعدة البيانات، وانتقل من SQLite إلى **PostgreSQL** (غيّر `DATABASE_URL` فقط).

## 📄 الترخيص

MIT
