# SlopIt — Bugfix Session Log

Этот документ описывает три последовательных исправления, выполненных в рамках одной сессии.
Все изменения задеплоены в `slopit-api` на Fly.io (регион `fra`), ветка `frontend`.

---

## Stage 1 — Admin styles fix

**Commit:** `8264a7b`
**Статус:** ✅ задеплоено, подтверждено работает

### Проблема

Django Admin выглядел сломано — стили не применялись.

### Причина

Статика для Admin не собиралась / не отдавалась корректно в production-сборке.

### Решение

Исправлена конфигурация сборки/отдачи статики так, чтобы `collectstatic` включал Admin CSS/JS.

---

## Stage 2 — Posts visibility fix

**Commit:** `dec8f8d`
**Файл:** `backend/src/slopit/apps/posts/views.py`
**Статус:** ✅ задеплоено, посты видны всем пользователям

### Проблема

Созданные пользователем посты были видны **только самому автору**. Другие пользователи
(и неавторизованные гости) получали пустую ленту, потому что `get_queryset` фильтровал
по `author = request.user` для неопубликованных постов.

### Причина

1. `PostViewSet.get_queryset` возвращал `PUBLISHED`-посты для всех, но при создании пост
   сохранялся со статусом `DRAFT` — и попадал только в ветку «показывай только автору».
2. `perform_create` не выставлял статус, поэтому посты так и оставались `DRAFT`.

### Решение

**`get_queryset`** — убрана auth-зависимая ветка, теперь всегда возвращает только
`PUBLISHED`:

```python
def get_queryset(self):
    qs = Post.objects.select_related("author").prefetch_related("tags")
    return qs.filter(status=Post.Status.PUBLISHED)
```

**`perform_create`** — пост сразу публикуется при создании:

```python
def perform_create(self, serializer):
    serializer.save(
        author=self.request.user,
        status=Post.Status.PUBLISHED,
        published_at=timezone.now(),
    )
```

**`publish` action** — сделан идемпотентным: если пост уже `PUBLISHED`, возвращает `200`
с данными вместо `400` (фронтенд вызывает `/publish/` после создания — теперь это безопасно).

---

## Stage 3 — Post slug uniqueness bug fix

**Commit:** `d0c9712`
**Файлы:**
- `backend/src/slopit/apps/posts/models.py`
- `backend/src/slopit/apps/posts/migrations/0002_fix_empty_slugs.py`
**Статус:** ✅ задеплоено, data migration выполнена успешно

### Проблема

`POST /api/v1/posts/` возвращал `500 Internal Server Error` при создании поста.

Лог Fly.io:

```
django.db.utils.IntegrityError: duplicate key value violates unique constraint "posts_post_slug_key"
DETAIL: Key (slug)=() already exists.
```

### Причина

Старый `Post.save()` работал в **два шага**:

1. Сначала `super().save()` — вставлял строку в БД с `slug = ""`.
2. Потом `Post.objects.filter(pk=pk).update(slug=<generated>)` — пытался обновить slug.

Если в таблице `posts_post` уже существовала строка с `slug = ""` (от предыдущего
упавшего/«осиротевшего» создания), второй `INSERT` нарушал `UNIQUE` ограничение на
колонку `slug` и Django выбрасывал `IntegrityError`.

### Решение

#### `models.py` — slug генерируется ДО `super().save()`

```python
import uuid
from django.utils.text import slugify

def save(self, *args, **kwargs) -> None:  # type: ignore[override]
    if self.body_markdown:
        self.body_html = _render_markdown(self.body_markdown)
    if not self.slug:
        base = slugify(self.title)[:100] or "post"
        self.slug = f"{base}-{uuid.uuid4().hex[:8]}"
    super().save(*args, **kwargs)
```

- `base = slugify(self.title)[:100] or "post"` — гарантирует не-пустую базу даже если
  заголовок пустой или состоит только из не-ASCII символов.
- UUID-суффикс из 8 hex-символов делает slug уникальным без обращения к БД.
- `super().save()` вызывается **один раз** — строка вставляется уже с правильным slug.

#### `0002_fix_empty_slugs.py` — data migration

```python
def fix_empty_slugs(apps, schema_editor):
    Post = apps.get_model("posts", "Post")
    for post in Post.objects.filter(slug=""):
        base = slugify(post.title)[:100] or "post"
        post.slug = f"{base}-{uuid.uuid4().hex[:8]}"
        post.save(update_fields=["slug"])
```

Миграция исправила все существующие строки с `slug = ""` в production БД.
Запускается как часть `release_command` (`python manage.py migrate --noinput`) при каждом
деплое — Fly.io подтвердил `✔ release_command completed successfully`.

---

## Deploy checklist (для воспроизведения)

```powershell
Push-Location "C:\Users\mrdan\SlopIt_App.worktrees\frontend-workflow\backend"
git add <files>
git commit -m "fix: ..."
C:\Users\mrdan\.fly\bin\flyctl.exe deploy --app slopit-api --config fly.toml --wait-timeout 300
Pop-Location
```

> **Важно:** `flyctl deploy` нужно запускать **из папки `backend/`** (там лежит `fly.toml`).
> `uv`-управляемый Python: `python manage.py` напрямую не работает — миграции создаются вручную.
