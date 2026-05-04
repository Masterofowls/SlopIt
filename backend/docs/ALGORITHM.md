# Алгоритм рандомизации ленты — спецификация

## 0. Терминология

| Термин                                               | Определение                                                                                                                                                        |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Системная лента** (System Feed Pool) | Глобальный пул всех опубликованных постов с метаданными для рандомизации                                      |
| **Snapshot**                                         | Зафиксированный персональный порядок ленты для конкретного пользователя на период `lifetime_hours` |
| **Seed**                                             | 64-битное целое, однозначно определяющее перетасовку snapshot                                                                     |
| **PFM** (`PostFeedMeta`)                           | Запись «метаданных рандомизации» поста: bucket, content_hash, rotation_offset                                                              |

## 1. Требования

1. Лента **полностью случайная**. Никакой сортировки по реакциям/времени/популярности.
2. Учитываются **предпочтения**: фильтр по словам/тегам и по типу поста (text/image/video).
3. **Воспроизводимость**: при перезагрузке страницы — тот же порядок.
4. **Автоперегенерация**: каждые 10 ч (по умолчанию), настраивается 10–48 ч.
5. **Антиспам по контенту**: не показывать подряд одинаковый/похожий контент,
   даже если он опубликован одним автором подряд или разными — в одно время.

## 2. Три уровня — обзор

```
┌──────────────────────────────────────────────────────────────────┐
│  L1. SYSTEM FEED POOL                                            │
│      Источник: все Post.status='published'                       │
│      Артефакт: индекс PostFeedMeta + материализованное представление│
│      Когда:   фоновая задача каждые N минут + on-publish         │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  L2. NEW-CONTENT INTAKE                                          │
│      Триггер: Post.publish() / publish webhook                   │
│      Действие: антидубль, антиспам по автору, anti-cluster по    │
│                времени, проставляет bucket + rotation_offset     │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  L3. PER-USER SHUFFLE                                            │
│      Триггер: GET /api/feed когда snapshot expired (или нет)     │
│      Действие: применить FeedPreferences (фильтры) → детерми-    │
│                нированный shuffle с seed → сохранить FeedSnapshot │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Уровень 1 — System Feed Pool

### 3.1 Цель

Подготовить плоский индекс всех «доступных для показа» постов с метаданными,
по которым можно быстро отфильтровать и перетасовать.

### 3.2 Структура `PostFeedMeta` (модель)

| Поле            | Тип             | Назначение                                                                             |
| ------------------- | ------------------ | ------------------------------------------------------------------------------------------------ |
| `post_id`         | `OneToOne(Post)` | PK                                                                                               |
| `bucket`          | `int`            | 0..N-1 — корзина для anti-clustering (см. 4.4)                                      |
| `content_hash`    | `char(16)`       | simhash от текста+медиа для дедупа                                         |
| `kind`            | `enum`           | копия `Post.kind` для быстрых фильтров                                  |
| `tag_ids`         | `int[]`          | PG array для GIN-индекса                                                               |
| `keyword_set`     | `tsvector`       | для матча с `FeedPreferences.filter_words`                                            |
| `rotation_offset` | `int`            | псевдо-сдвиг внутри bucket                                                      |
| `published_at`    | `timestamptz`    | копия (только для time-bucket'инга)                                            |
| `is_eligible`     | `bool`           | `true` если можно показывать (не removed, автор не забанен) |
| `version`         | `int`            | инкрементируется при ребилде индекса                            |

Индексы:

- `(is_eligible, bucket)` — для выборки в L3.
- GIN на `tag_ids`, `keyword_set`.

### 3.3 Когда обновляется

| Событие                          | Действие                                                                    |
| --------------------------------------- | ----------------------------------------------------------------------------------- |
| `Post.publish()`                      | Уровень 2 создаёт/обновляет `PostFeedMeta`                 |
| `Post.delete()` / `removed`         | `is_eligible = False`                                                             |
| Бан автора                     | bulk update `is_eligible=False` для его постов                        |
| Smart-rebuild раз в час (RQ-job) | пересчёт `bucket` и `rotation_offset` для свежих постов |

### 3.4 Псевдокод инициализации

```python
def initialize_system_feed() -> None:
    """One-shot bootstrap: build PostFeedMeta for every published post."""
    for post in Post.objects.filter(status="published").iterator():
        upsert_post_feed_meta(post)
```

---

## 4. Уровень 2 — New-content Intake

### 4.1 Цель

При публикации нового поста:

- Посчитать `content_hash` (текст + хеши медиа).
- Решить, не дубль ли это (по simhash distance < 4 → пометить как `near_duplicate`).
- Расположить в **bucket** так, чтобы рядом не оказалось:
  - постов того же автора (по соседним bucket'ам),
  - постов с похожим `content_hash`,
  - постов опубликованных в ±5 минут от него (anti-burst).

### 4.2 Bucket model

Делим всё пространство на `B = 256` буккетов (число подбирается по объёму). Bucket выбирается так:

```
candidates = list(range(B))
shuffle(candidates, key=hash(post.id))      # детерминированный rand

for bucket in candidates:
    if violates_constraints(post, bucket):
        continue
    return bucket

# fallback: первый кандидат
return candidates[0]
```

**Constraint check** для кандидата `b`:

```
neighbors = PostFeedMeta.objects.filter(bucket__in=[b-1, b, b+1])

violates if any of:
  - same_author      ∈ neighbors
  - simhash_distance(post.content_hash, n.content_hash) < 4   for n in neighbors
  - |post.published_at - n.published_at| < 5min                for n in neighbors
```

### 4.3 `rotation_offset`

Внутри bucket'а — псевдо-случайный сдвиг 0..1023 для тонкой перетасовки в L3.
Считается как `hash(post.id) % 1024`.

### 4.4 Псевдокод

```python
def on_post_published(post: Post) -> PostFeedMeta:
    content_hash = simhash(post.body_text + media_hash_of(post))

    if find_near_duplicate(content_hash):
        post.flag_as_duplicate()  # модератору на проверку
        # всё равно индексируем, но bucket выберем подальше

    bucket = pick_bucket(post, content_hash)
    rotation = stable_hash(post.id) % 1024

    return PostFeedMeta.objects.update_or_create(
        post=post,
        defaults=dict(
            bucket=bucket,
            content_hash=content_hash,
            kind=post.kind,
            tag_ids=list(post.tags.values_list("id", flat=True)),
            keyword_set=build_keyword_tsvector(post),
            rotation_offset=rotation,
            published_at=post.published_at,
            is_eligible=True,
        ),
    )
```

---

## 5. Уровень 3 — Per-user Shuffle

### 5.1 Модель `FeedSnapshot`

| Поле       | Тип                                                                           |
| -------------- | -------------------------------------------------------------------------------- |
| `id`         | UUID PK                                                                          |
| `user`       | FK(User)                                                                         |
| `seed`       | `bigint` — определяет порядок                                |
| `created_at` | `timestamptz`                                                                  |
| `expires_at` | `timestamptz`                                                                  |
| `post_ids`   | `int[]` — материализованный порядок                   |
| `version`    | `int` — версия `PostFeedMeta`, под которую построен |

### 5.2 Алгоритм генерации

```python
def generate_snapshot(user: User, prefs: FeedPreferences) -> FeedSnapshot:
    seed = secrets.randbits(64)             # 1. новый seed на каждую генерацию
    rng = random.Random(seed)

    # 2. eligible pool
    qs = PostFeedMeta.objects.filter(is_eligible=True)

    # 3. apply preferences
    if prefs.filter_post_types:
        qs = qs.filter(kind__in=prefs.filter_post_types)
    if prefs.filter_words:
        qs = qs.exclude(keyword_set__match=prefs.filter_words_query())
    if prefs.muted_tag_ids:
        qs = qs.exclude(tag_ids__overlap=prefs.muted_tag_ids)
    if prefs.muted_user_ids:
        qs = qs.exclude(post__author_id__in=prefs.muted_user_ids)

    # 4. собрать в bucket-aware порядке
    rows = list(qs.values_list("post_id", "bucket", "rotation_offset"))

    # 5. перетасовка с учётом bucket: bucket-major round-robin для anti-cluster
    by_bucket: dict[int, list[int]] = defaultdict(list)
    for post_id, bucket, offset in rows:
        by_bucket[bucket].append((post_id, offset))

    # внутри bucket — сортируем по rotation_offset XOR seed, потом round-robin
    ordered: list[int] = []
    bucket_order = list(by_bucket.keys())
    rng.shuffle(bucket_order)

    for b in bucket_order:
        items = by_bucket[b]
        items.sort(key=lambda x: x[1] ^ (seed & 0xFFFFFFFF))
        ordered.append(items)  # будет round-robin'нуто ниже

    flat = round_robin(ordered)  # [b0_0, b1_0, b2_0, ..., b0_1, b1_1, ...]

    return FeedSnapshot.objects.create(
        user=user,
        seed=seed,
        post_ids=flat,
        expires_at=now() + timedelta(hours=user.profile.feed_lifetime_hours),
        version=current_pool_version(),
    )
```

### 5.3 Свойства

| Свойство                                            | Как достигается                                                         |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Полная случайность**               | seed =`secrets.randbits(64)`; никаких score-функций                   |
| **Воспроизводимость при reload**  | snapshot хранит `post_ids[]`; reload = тот же массив               |
| **Anti-clustering**                                   | round-robin по bucket'ам (L2)                                                     |
| **Учёт предпочтений**                 | фильтры применяются на этапе SQL до перетасовки |
| **Перегенерация раз в N часов** | при `now() > snapshot.expires_at` создаётся новый                  |
| **Fairness между авторами**              | bucket выбирается с учётом same-author neighbor (L2)                 |

### 5.4 Пагинация

`GET /api/feed?cursor=N&limit=25` → `snapshot.post_ids[N : N+25]`. Cursor = индекс в массиве.
Никакого `created_at`-cursor — только индекс в snapshot.

### 5.5 Когда снапшот не используется

- При первом заходе — создаётся новый.
- При смене `FeedPreferences` — старый инвалидируется, создаётся новый
  (с **новым seed** — это важно, иначе пользователь увидит «те же первые посты»).
- Когда `now() > expires_at`.
- Когда `snapshot.version < current_pool_version()` (была массовая ребалансировка пула).

---

## 6. Edge cases

| Кейс                                                            | Решение                                                                                                       |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Пользователь долистал до конца snapshot  | Возвращаем `next: null` + предлагаем форсированную регенерацию         |
| Пост удалён уже после генерации snapshot | Skip при выдаче (фильтр `is_eligible=true` на read)                                               |
| Пост стал ineligible (бан)                               | То же — фильтруем при выдаче                                                                  |
| Очень мало контента                                | `bucket` коллапсирует; используем общий случайный shuffle                      |
| Поток одинаковых постов от бота          | L2 ставит `near_duplicate`; модератор удаляет; пул чистится                       |
| Пользователь меняет lifetime с 10ч на 2д     | Применяется к**следующему** snapshot (текущий доживает свой срок) |

---

## 7. Производительность

- L1 индекс: ~16 байт ключевых полей × N постов. 1M постов = ~16 МБ — в RAM PG свободно.
- L2 на публикацию: 1 simhash + 1..3 SQL → < 50 мс.
- L3 генерация: для 100k eligible постов — < 200 мс при правильных индексах.
- Снапшот: `post_ids: int[]` для 100k = ~400 КБ; для пагинации в БД хорошо.
- Обновление снапшотов: фоновой RQ-job по расписанию (rq-scheduler).

---

## 8. Тестируемость

```
tests/feed/
├── test_simhash.py          # L2: похожесть/непохожесть
├── test_bucket_picker.py    # L2: ограничения соблюдены
├── test_shuffle.py          # L3: детерминированность по seed
├── test_preferences.py      # L3: фильтры
└── test_pagination.py       # L3: cursor стабилен
```

Ключевой тест:

```python
def test_same_seed_yields_same_order():
    snap1 = generate_snapshot(user, prefs)
    snap2 = FeedSnapshot.from_seed(user, prefs, seed=snap1.seed)
    assert snap1.post_ids == snap2.post_ids
```

---

## 9. Реализация по файлам (Stage 3)

```
apps/feed/
├── models.py                  # PostFeedMeta, FeedSnapshot, FeedPreferences
├── services/
│   ├── __init__.py
│   ├── level1_pool.py         # initialize_system_feed, rebuild_post_meta
│   ├── level2_intake.py       # on_post_published, simhash, bucket_picker
│   ├── level3_personal.py     # generate_snapshot, get_or_create_active
│   └── primitives.py          # simhash, round_robin, stable_hash
├── jobs.py                    # RQ tasks
├── signals.py                 # post_save Post → level2
├── views.py                   # FeedViewSet (paginate from snapshot)
└── tests/
```
