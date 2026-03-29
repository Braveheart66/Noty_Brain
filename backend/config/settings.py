import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


def _get_int_env(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _split_csv_env(name: str, default: str, strip_trailing_slash: bool = False) -> list[str]:
    raw = os.getenv(name, default)
    values = []
    for item in raw.split(","):
        cleaned = item.strip()
        if not cleaned:
            continue
        if strip_trailing_slash:
            cleaned = cleaned.rstrip("/")
        values.append(cleaned)
    return values


def _split_hosts_env(name: str, default: str) -> list[str]:
    values = []
    for item in os.getenv(name, default).split(","):
        host = item.strip()
        if not host:
            continue
        if host.startswith("http://"):
            host = host[len("http://") :]
        elif host.startswith("https://"):
            host = host[len("https://") :]
        host = host.split("/", 1)[0].strip()
        if not host:
            continue
        # Django ALLOWED_HOSTS expects hostname patterns without ports.
        if ":" in host and not host.startswith("["):
            host = host.split(":", 1)[0]
        values.append(host)

    render_hostname = os.getenv("RENDER_EXTERNAL_HOSTNAME", "").strip()
    if render_hostname:
        values.append(render_hostname)

    # Preserve order while deduplicating.
    deduped = []
    seen = set()
    for host in values:
        if host in seen:
            continue
        seen.add(host)
        deduped.append(host)
    return deduped

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "change-me-in-env")
DEBUG = os.getenv("DJANGO_DEBUG", "true").lower() == "true"
ALLOWED_HOSTS = _split_hosts_env("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")


# Application definition

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt",
    "accounts",
    "notes",
    "search",
    "graph",
    "analytics",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


# Database
# https://docs.djangoproject.com/en/6.0/ref/settings/#databases

DATABASES = {
    "default": {
        "ENGINE": os.getenv("DB_ENGINE", "django.db.backends.postgresql"),
        "NAME": os.getenv("DB_NAME", "noty_brain"),
        "USER": os.getenv("DB_USER", "noty_user"),
        "PASSWORD": os.getenv("DB_PASSWORD", "noty_pass"),
        "HOST": os.getenv("DB_HOST", "localhost"),
        "PORT": os.getenv("DB_PORT", "5432"),
    }
}


# Password validation
# https://docs.djangoproject.com/en/6.0/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


# Internationalization
# https://docs.djangoproject.com/en/6.0/topics/i18n/

LANGUAGE_CODE = "en-us"

TIME_ZONE = os.getenv("APP_TIME_ZONE", "UTC")

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/6.0/howto/static-files/

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "accounts.User"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PARSER_CLASSES": (
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.FormParser",
        "rest_framework.parsers.MultiPartParser",
        "config.parsers.PlainTextJSONParser",
    ),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": False,
    "BLACKLIST_AFTER_ROTATION": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

CORS_ALLOWED_ORIGINS = _split_csv_env(
    "CORS_ALLOWED_ORIGINS", "http://localhost:5173", strip_trailing_slash=True
)
CORS_ALLOWED_ORIGIN_REGEXES = _split_csv_env("CORS_ALLOWED_ORIGIN_REGEXES", "")
CSRF_TRUSTED_ORIGINS = _split_csv_env(
    "CSRF_TRUSTED_ORIGINS", "http://localhost:5173", strip_trailing_slash=True
)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "none")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://host.docker.internal:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b-instruct")
OLLAMA_TIMEOUT_SECONDS = _get_int_env("OLLAMA_TIMEOUT_SECONDS", 120)

CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
