# URL Shortener + Analytics Platform — Backend Study Notes

Бұл конспект `C:\ENT\url-shortener\backend` ішіндегі нақты кодқа негізделген. Тексеру кезіндегі commit: `c245a34`. Бүкіл жобаны үйрену үшін осы файлды, жалғастыру кезінде жасалған өзгерістер үшін [study-next-prompt.md](study-next-prompt.md) файлын оқыңыз. Құжат дайындағанда сервер, тесттер және migrations іске қосылмады.

## 1. Project мақсаты

Backend ұзын URL үшін қысқа атау жасайды, оны ашқан адамды бастапқы сайтқа бағыттайды және әр өтудің аналитикасын жинайды. Қысқа сілтемені хабарламада, жарнамада немесе QR-кодта бөлісу ыңғайлы; аналитика аудиторияның қайдан және қандай құрылғыдан келгенін көрсетеді.

```text
https://example.com/very/long/url
                ↓ сілтеме жасау
http://localhost:3000/abc1234
                ↓ GET /abc1234
302 + Location: https://example.com/very/long/url
                ↓ браузер бастапқы сайтты ашады
BullMQ Worker → PostgreSQL-дегі Click → аналитика
```

Redis сілтемені кэштен жылдам табуға және өту лимитін санауға көмектеседі. BullMQ аналитиканы кезекке салады: redirect Click жазбасының DB-ге сақталуын күтпейді.

## 2. Қолданылған технологиялар

| Technology | Бұл проектте не үшін керек |
| --- | --- |
| Node.js | JavaScript backend-ті орындайды. `package.json`: Node 22.12+ (22 тармағы) немесе 24+. |
| Express 5 | HTTP сұрауларын қабылдап, Middleware және Route арқылы өңдейді. |
| PostgreSQL | User, Link, Click деректерін тұрақты сақтайды; Compose-та PostgreSQL 16. |
| Prisma 7 | JavaScript арқылы DB сұрауларын, transactions және SQL aggregates орындауға көмектеседі. |
| `@prisma/adapter-pg`, `pg` | PrismaClient-ті PostgreSQL драйверімен байланыстырады. |
| Redis, `ioredis` | Кэш, өту резервтері және BullMQ деректерін сақтайды; Compose-та Redis 7. |
| BullMQ | `analytics` Queue мен Worker арқылы click өңдеуді фонға шығарады. |
| JWT, `jsonwebtoken` | Account token және бес минуттық redirect token шығарып, қолтаңбасы мен мерзімін тексереді. |
| `bcryptjs` | User және Link құпиясөздерін hash-тайды; салыстыру кезінде бастапқы құпиясөзді қалпына келтірмейді. |
| `express-validator` | Body, UUID, slug және query параметрлерін тексереді. |
| `express-rate-limit` | Бір IP-ден келетін сұраулар санын уақыт аралығында шектейді. |
| Helmet | Қауіпсіздікке арналған HTTP headers қояды. |
| CORS | Браузерге қай origin-нен жауапты оқуға болатынын анықтайды. |
| Morgan | HTTP method, Route үлгісі, status және уақытты Winston-ға жібереді. |
| Winston | Құпия мәндерді жасырып, консольге және log файлдарына жазады. |
| `ua-parser-js` | User-Agent мәтінінен browser, OS, device анықтайды. |
| `geoip-lite` | IP бойынша ел/қаланы жергілікті GeoIP базасынан іздейді. |
| `qrcode` | Қысқа URL-ді PNG QR-кодқа айналдырады. |
| Swagger/OpenAPI | API сипаттамасын және `/api-docs` интерактивті бетін береді. |
| Jest | Тесттерді, assertions және mocks орындайды. |
| Supertest | Express app-қа тесттік HTTP сұрауларын жібереді. |
| Docker, Docker Compose | PostgreSQL/Redis контейнерлерін, қажет болса API контейнерін іске қосады. |
| `dotenv` | `.env` мәндерін оқиды; `env.js` оларды тексереді. |
| nodemon | `npm run dev` кезінде код өзгерсе серверді қайта іске қосады. |

Жоба CommonJS (`require`, `module.exports`) қолданады. `prisma7.config.ts` — Prisma CLI үшін бөлек TypeScript config; backend түгел TypeScript-ке көшірілмеген.

## 3. Project архитектурасы

Маңызды нақты құрылым (`node_modules`, tooling skills және runtime logs көрсетілмеді):

```text
backend/
├── server.js
├── test-db.js
├── package.json / package-lock.json
├── prisma7.config.ts / jest.config.js
├── .env.example / .gitignore / .dockerignore
├── Dockerfile / docker-compose.yml / README.md
├── prisma/
│   ├── schema.prisma
│   ├── seed.js                         # қазір бос
│   └── migrations/
│       ├── migration_lock.toml
│       └── 20260913164558_init/migration.sql
├── src/
│   ├── app.js
│   ├── config/                         # database.js, env.js, redis.js
│   ├── controllers/                    # auth, link, redirect, analytics, admin
│   ├── routes/                         # сол бес бағыттың Route файлдары
│   ├── services/                       # auth, link, redirect, analytics, qr
│   ├── middleware/                     # auth, admin, validate, rateLimiter, errorHandler
│   ├── validators/                     # authValidator, linkValidator, analyticsValidator
│   ├── queues/                         # analyticsQueue.js, analyticsWorker.js
│   ├── docs/openapi.js
│   └── utils/                          # 25-бөлімде әр файл көрсетілген
├── tests/
│   ├── *.test.js                       # 23-бөлімде барлық 10 файл
│   ├── setup.js / helpers.js
│   └── support/database.js / redis.js
└── uploads/qr/                         # .gitkeep және жасалған PNG файлдары
```

```text
HTTP → Route → Middleware/Validator → Controller → Service
                                                ↓
                                  Prisma / Redis / Queue → Response
```

Route қай URL қай функцияға баратынын анықтайды. Middleware рұқсатты және деректі тексереді. Controller `req` ішінен мәндерді алып, Service шақырады және HTTP жауап береді. Service бизнес ережелерін орындайды және DB/Redis-пен жұмыс істейді.

Екі ерекшелік бар: `adminController.js` Prisma-ны тікелей шақырады; фондық analytics Processor HTTP Controller-ден өтпейді.

## 4. server.js және app.js

### `server.js`

`startServer()` реті: config → logger → Prisma `$connect()` → Redis ready/ping → Express app → Queue/Worker дайын болуы → `app.listen(port, "0.0.0.0")`. Redis және Queue/Worker дайын болуын күтуге 10 секундтық шектер бар. API мен Worker бір Node.js процесінде жүреді.

`shutdown()` HTTP, Worker/Queue, Prisma және Redis-ті ретімен жабады. SIGINT, SIGTERM, startup failure, unhandled rejection және uncaught exception өңделеді. `require.main === module` серверді файл тікелей орындалғанда ғана қосады; `startServer`/`shutdown` экспортталады. Сервер автоматты migration немесе seed орындамайды.

### `src/app.js`

Орнату реті:

1. `x-powered-by` жасыру, `trust proxy`, Helmet, CORS.
2. Test режимінен тыс Morgan → Winston.
3. `/api` general limiter, `/api/auth` қосымша auth limiter.
4. JSON/urlencoded parser: әрқайсысының шегі `100kb`; urlencoded `extended: false`.
5. `/health`, `/ready`, `/api-docs.json`, `/api-docs`.
6. Auth, Link, Analytics, Admin Route-тары.
7. Тек `/uploads/qr` static: dotfiles рұқсат етілмейді, directory index жоқ.
8. Public Redirect Route, соңында `notFoundHandler`, `errorHandler`.

`/:slug` бір сегментті кез келген атауды ұстай алады. Сондықтан `/health`, `/ready`, `/api-docs` және нақты API/static бағыттары оның алдында тұр. Reserved slug validation де жүйелік атауларды пайдаланушының иеленуіне жол бермейді.

## 5. Config файлдары

### `src/config/env.js`

**Қызметі:** `.env` оқу және қате конфигурацияны сервер қосылмай тұрып анықтау.

**Негізгі нәрселер:** `required()`, `parseUrl()`; `port`, `nodeEnv`, `databaseUrl`, `redisUrl`, `jwtSecret`, `jwtExpiresIn`, `baseUrl`, `clientOrigins`, `trustProxy` экспорттары. Server, app, DB/Redis, JWT және Link/QR utilities қолданады.

`NODE_ENV` тек development/test/production; port 1–65535. URL protocols тексеріледі. `BASE_URL` мен `CLIENT_URL` тек origin болуы керек: credentials, path, query, fragment қабылданбайды. Production JWT secret кемінде 32 таңба болуы және белгілі placeholder болмауы керек. JWT мерзімі — `7d` сияқты оң duration, 1 секундтан 10 жылға дейін. `TRUST_PROXY` — `false` немесе сенімді proxy тізімі; жай `true`/сан қабылданбайды.

Test режимі тек `TEST_DATABASE_URL` қолданады: DB атауында жеке `test` бөлігі болуы және development DB атауынан бөлек болуы қажет.

### `src/config/database.js`

**Қызметі:** ортақ PrismaClient жасау. `PrismaPg({ connectionString: env.databaseUrl })` adapter-і `new PrismaClient({ adapter })` ішіне беріледі. Connection timeout 5 секунд, statement timeout 10 секунд. Services, Admin Controller, Processor, app және server осы client-ті импорттайды.

### `src/config/redis.js`

**Қызметі:** API мен Queue producer үшін ортақ `ioredis` connection жасау.

**Негізгі нәрселер:** connection/command timeout 5 секунд, `maxRetriesPerRequest: 1`, `enableOfflineQueue: false`; connection events Winston-ға жазылады. Redirect/Link/Analytics Services, app/server және Queue қолданады. Worker бөлек `duplicate()` connection жасайды; оның retry талаптары өзгеше.

## 6. Prisma және Database

Schema provider — PostgreSQL. Generator — `prisma-client-js`; импорт `@prisma/client` арқылы. Prisma 7 connection URL schema ішіне жазылмаған: CLI оны `prisma7.config.ts`, app оны `env.js` + PostgreSQL adapter арқылы алады.

`prisma7.config.ts` schema/migrations жолдарын анықтайды. Config атауы стандарттан бөлек болғандықтан npm Prisma scripts `--config prisma7.config.ts` береді. Test режиміндегі CLI де бөлек test DB-ді тексереді.

`20260913164558_init/migration.sql` үш кесте, екі enum, indexes және cascade relations жасайды. `migration_lock.toml` provider-ді белгілейді. Жалғастыру commit-і schema/migration-ды өзгертпеген. `prisma/seed.js` бос, автоматты дерек қоспайды.

### User

| Field | Мағынасы |
| --- | --- |
| `id` | UUID primary key. |
| `email @unique` | Бір email-мен екі аккаунт жасалмайды. |
| `password` | bcrypt hash. |
| `name`, `role` | Аты және USER/ADMIN рөлі; default USER. |
| `links`, `createdAt` | Сілтемелер relation-ы және тіркелген уақыт. |

### Link

| Field | Мағынасы |
| --- | --- |
| `id`, `slug @unique` | UUID және бірегей қысқа атау. |
| `originalUrl`, `title` | Бастапқы URL және optional тақырып. |
| `status`, `password` | LinkStatus және optional bcrypt hash. |
| `userId`, `user` | Иесі; User жойылса Link те cascade арқылы жойылады. |
| `expiresAt`, `maxClicks` | Optional мерзім және өту шегі. |
| `clickCount` | Worker DB-ге сақтаған click саны; default 0. |
| `tags`, `qrCodeUrl` | Белгілер массиві және optional QR файл URL-і. |
| `clicks`, `createdAt`, `updatedAt` | Click relation-ы, құрылған/өзгерген уақыт. |

### Click

`id` — UUID; `linkId`/`link` — сілтемеге relation; `clickedAt` — өту уақыты; `ip`, `userAgent` — сұрау деректері; `browser`, `os`, `device`, `country`, `city` — талдау нәтижелері; `referer`, `utmSource`, `utmMedium`, `utmCampaign` — келу көзі. Link жойылса Click те cascade арқылы жойылады.

```text
User 1 ─── N Link 1 ─── N Click
```

`Role`: USER, ADMIN. `LinkStatus`: ACTIVE, EXPIRED, DISABLED, PASSWORD_PROTECTED. Бірақ қазіргі code password protection-ды `Boolean(link.password)` арқылы тексереді; password қосу status-ты PASSWORD_PROTECTED-ке автоматты өзгертпейді. Мерзімі біткенде де status DB-де автоматты EXPIRED болып жазылмайды.

`@unique` DB деңгейінде email/slug қайталануын тоқтатады, соның ішінде қатар келген сұрауларда. `@@index` іздеуді/сұрыптауды қолдайды: userId, status, createdAt, linkId+clickedAt, country.

## 7. Authentication жүйесі

### Register — `POST /api/auth/register`

Client → `authRoutes` → `registerValidator` → `validate` → `authController.register` → `authService.register` → email қайталануын тексеру → bcrypt hash → Prisma User.create → account JWT → `201 { success, data: { user, token } }`.

Аты 2–50 таңба, email дұрыс/normalized, password кемінде 6 таңба және ең көбі 72 UTF-8 байт. Client жіберген role қолданылмайды; жаңа User default USER болады. Password/hash жауапқа кірмейді.

### Login — `POST /api/auth/login`

Normalized email + password → User.findUnique → bcrypt.compare → account JWT → 200. Email жоқ болса да, password қате болса да бірдей `Invalid email or password` және 401 беріледі.

### Me — `GET /api/auth/me`

`Authorization: Bearer <account-token>` → `auth` Middleware → JWT signature/expiry/claims тексеру → `req.user = { userId, role }` → Controller → Service → safe profile.

Middleware әр сұрауда User-ді DB-ден қайта оқымайды: рөлді қолтаңбасы тексерілген token-нен алады. `/me` Service профильді DB-ден оқиды.

### Logout — `POST /api/auth/logout`

Auth қажет; Controller тек `200 Logout successful` қайтарады. Client өз token-ін өшіруі керек. Blacklist, refresh token және server-side token revocation жоқ: бұрынғы account JWT мерзімі біткенше жарамды.

| File | Жеке міндеті |
| --- | --- |
| `authRoutes.js` | Register/login validators-ті, me/logout auth Middleware-ін жалғайды. |
| `authController.js` | Service нәтижесін HTTP status пен JSON-ға айналдырады; logout acknowledgement береді. |
| `authService.js` | Email uniqueness, registration, login, profile және safe user fields. |
| `middleware/auth.js` | Bearer пішімі, UUID userId, USER/ADMIN role, integer exp тексереді; redirect-purpose token қабылдамайды. |
| `utils/jwt.js` | Account JWT, redirect JWT шығарады; тек HS256 verification. |
| `utils/bcrypt.js` | `hashPassword`, `comparePassword`; salt rounds = 10. |
| `validators/authValidator.js` | Register/login мәндерін DB-ге жетпей тексереді. |

## 8. Link CRUD

Барлық endpoint account JWT талап етеді. Қалыпты Link API тек иесінің ресурстарын береді; ADMIN да өзгенің Link-ін осы endpoint арқылы аша алмайды. Foreign/missing Link → 404.

### POST /api/links

**Не істейді:** жаңа қысқа сілтеме жасайды; 201.

**Authentication:** account JWT.

**Негізгі flow:** auth → create validator → Controller → Service → custom slug uniqueness немесе generated slug → optional password hash → Prisma.create → safe Link.

### GET /api/links

**Не істейді:** өз сілтемелерін newest-first береді; 200.

**Authentication:** account JWT.

**Негізгі flow:** pagination validator → Service → `where: { userId }`, skip/take + count transaction → links/pagination. Default page 1, limit 10.

### GET /api/links/:id

**Не істейді:** өз Link-інің мәліметін береді; 200.

**Authentication:** account JWT.

**Негізгі flow:** UUID validator → `findFirst({ id, userId })` → hash-ты жасыру + shortUrl.

### PATCH /api/links/:id

**Не істейді:** жіберілген рұқсатты fields-ті ғана өзгертеді; 200.

**Authentication:** account JWT.

**Негізгі flow:** UUID/body validation → ownership → allowedFields → Prisma.update → Redis invalidation. `null` title/password/expiresAt/maxClicks шектеулерін тазалайды. Slug өзгерсе live counter жаңа key-ге көшеді, ескі QR жойылып `qrCodeUrl = null` болады. `userId`, `clickCount`, `status` body арқылы өзгертілмейді.

### DELETE /api/links/:id

**Не істейді:** Link-ті жояды; 200 message.

**Authentication:** account JWT.

**Негізгі flow:** ownership → Prisma.delete (Click cascade) → cache/counter delete → қауіпсіз QR cleanup.

### POST /api/links/:id/toggle

**Не істейді:** DISABLED → ACTIVE; басқа status → DISABLED; 200.

**Authentication:** account JWT.

**Негізгі flow:** ownership → DB status update → Redis Link cache delete. Password, expiry, maxClicks сақталады.

### POST /api/links/:id/qr

**Не істейді:** QR PNG жасайды; 201.

**Authentication:** account JWT.

**Негізгі flow:** UUID/QR validation → linkController → qrService → ownership → PNG → file → DB URL → old file cleanup.

`linkRoutes.js` URL/Middleware-ді, `linkController.js` HTTP жауапты, `linkService.js` CRUD/ownership/cache әрекеттерін басқарады. `linkValidator.js` HTTP(S) URL (credentials жоқ), slug 3–50, tags ≤20 (әрқайсысы 1–50), title ≤200, future ISO expiry және positive 32-bit maxClicks тексереді.

`slugGenerator.js` `crypto.randomInt()` арқылы 7 таңбалы letters/digits slug жасайды; бірнеше conflict-тен кейін 9 таңбаға өтеді. Service те create кезіндегі P2002 conflict-ке retry жасайды. Custom slug қайталанса 409; DB `@unique` соңғы қорғаныс. Slug case-sensitive.

## 9. Redirect қалай жұмыс істейді?

`GET /abc1234` account JWT талап етпейді. Толық flow:

```text
redirectLimiter → slug/token validator → redirectController
                           ↓
redirectService.getLinkBySlug
    Redis link:abc1234 HIT → cached Link
    MISS/бұзылған JSON → PostgreSQL → Redis SET EX 3600
                           ↓
DISABLED / EXPIRED / expiresAt / maxClicks / password token тексеру
                           ↓
incrementClickCount → Redis Lua арқылы slot резервтеу
                           ↓
clickId + clickedAt + тазаланған metadata → Queue.add("track-click")
                           ↓
302 + Location: originalUrl
```

`redirectRoutes.js` public Middleware-ді жалғайды. `redirectService.js` Link-ті табады, рұқсатты тексереді, count резервтейді. `redirectController.js` job құрып, Queue қабылдағаннан кейін 302 береді.

HTTP 302 — браузерге `Location` URL-ін ашуды айтатын уақытша redirect. Request query параметрлері destination-ға автоматты жалғанбайды; бастапқы `originalUrl` қолданылады.

Lua кәдімгі бөлек `GET → check → INCR` орнына соңғы limit check пен increment-ті бір Redis операциясында жасайды. Осылайша қатар келген сұраулар бір бос slot-ты бірге ала алмайды.

Queue submission сәтсіз болса 302 берілмейді; Redis резерві сақталады. Себебі timeout кезінде job Queue-ға кіріп үлгерген болуы мүмкін. Сондықтан queue outage лимиттің бір бөлігін redirect орындалмаса да жұмсауы мүмкін.

## 10. Password protected link

Жасау/өңдеу кезінде: Link password → `hashPassword()` → bcrypt hash → `Link.password`. Plain text DB-ге сақталмайды; hash API жауабында көрсетілмейді.

```text
POST /abc1234/verify { password }
  → redirect/password limiters → validators
  → DB Link → disabled/expired тексеру → bcrypt.compare
  → maxClicks тексеру → generateRedirectToken(link.id)
  → { redirectUrl: originalUrl, token }

GET /abc1234?token=<temporary-token>
  → signature + exp + purpose + linkId тексеру
  → қалған restrictions + click reservation → Queue → 302
```

Verify Click жасамайды және slot резервтемейді; тек рұқсат token-ін береді. Account JWT `{ userId, role }`, ал redirect JWT `{ linkId, purpose: "redirect" }`, мерзімі 5 минут. Екеуі бір signing secret қолданады, бірақ claims тексерісі оларды бірінің орнына бірін қолдануға жол бермейді. Redirect token бір рет пайдаланылатын token емес; мерзімі ішінде қайта пайдалануға болады, әр redirect басқа шектеулерді қайта тексереді.

Hash — құпиясөздің қайтарылмайтын тексеру нәтижесі. DB дерегі шықса, бастапқы құпиясөздің бірден оқылуын азайтады; оны encryption немесе толық тәуекелсіз сақтау деп түсінбеу керек.

## 11. Expiration, maxClicks, toggle

### expiresAt

Date ≤ қазіргі уақыт немесе status EXPIRED болса 410. Background scheduler status-ты өзгертпейді: шектеу redirect/verify кезінде тексеріледі. PATCH future date береді немесе `null` арқылы мерзімді алып тастайды.

### maxClicks

Redis `link:<slug>:clicks` — қабылданған redirect резервтерінің live count-ы; DB `Link.clickCount` — Worker сақтаған count. Тексеруде `Math.max(redisCount, dbCount)` пайдаланылады. Counter жоқ болса, резервтеу алдында қазіргі DB count қайта оқылады; ескі cached count жаңа baseline ретінде соқыр қолданылмайды. Lua шекке жеткенде `-1`, Service 410 береді. Counter-ге TTL қойылмаған.

### Toggle

ACTIVE ↔ DISABLED — негізгі қолдану; нақты code DISABLED-тен ACTIVE-ке, кез келген басқа күйден DISABLED-ке ауыстырады. Link cache жойылады. Қайта қосу expiry-ді, парольді немесе жұмсалған click count-ты тазаламайды.

## 12. Redis

| Нақты key | Не сақтайды | Lifecycle |
| --- | --- | --- |
| `link:abc1234` | Redirect-ке қажет Link JSON, ішкі password hash қоса. | TTL 3600 секунд; update/toggle/delete кезінде invalidation. |
| `link:abc1234:clicks` | Live click reservation count. | TTL жоқ; delete кезінде жойылады; slug rename кезінде Lua-мен көшеді. |
| `bull:analytics:*` | BullMQ өзі басқаратын Queue/jobs metadata (әдепкі prefix). | Job retention ережелері Queue config-інде. |

```text
Request → Redis HIT → DB Link оқуын өткізіп жіберу
Request → Redis MISS → PostgreSQL → Redis SET → жалғастыру
```

Cache MISS пен Redis outage бөлек: MISS кезінде DB fallback бар; Redis connection істемесе бұл code жалпы «Redis-сіз режимге» көшпейді. Queue мен atomic limit те Redis-ке тәуелді. PostgreSQL mutation және Redis invalidation ортақ distributed transaction емес.

## 13. BullMQ

Queue — тапсырманы Redis-ке қабылдайтын producer. Worker — сол тапсырманы алатын consumer. Қазіргі `analyticsQueue.js` және `analyticsWorker.js` бір `analytics` атауын пайдаланады.

```text
Redirect → analyticsQueue.add("track-click", payload, { jobId: clickId })
                                    ↓ Redis
                      analyticsWorker → processAnalyticsJob
                                    ↓
                 UA/GeoIP → transaction → Click + Link.clickCount
```

Queue add-ты redirect күтеді; Worker processing аяқталуын күтпейді. Сондықтан GeoIP/parser/DB analytics жұмысы сұраудың негізгі жауап жолынан бөлінген, статистика сәл кеш жаңарады.

`analyticsQueue.js`: attempts 3, exponential backoff бастапқы delay 1000 ms, соңғы 1000 completed және 5000 failed job сақталады. Бұл settings бұрын да болған; жаңа жалғастыруда error logging қосылған.

`analyticsWorker.js`: concurrency 20; `workerRedis` duplicate connection үшін unlimited request retries/offline queue бар. Worker close оның connection-ын да жабады.

`utils/analyticsProcessor.js`: metadata тазалау, parsing, Click сақтау және DB count increment. Бір тұрақты clickId + `createMany(skipDuplicates: true)` қайталанған job-ты екі рет санатпайды. Click пен increment бір transaction ішінде. Ескі job-та clickId болмаса, job.id-ден тұрақты hash ID жасалады. Жойылған Link-ке арналған P2003/P2025 job қайта-қайта retry жасамай аяқталады.

## 14. Analytics

Controller `req.ip`, User-Agent, Referer және үш UTM мәнін жинайды. Processor User-Agent-тен browser/OS/device, GeoIP-тен country/city шығарады. `clickedAt` жаңа job-та redirect қабылданған уақыттан алынады, Worker кешіккен уақыттан емес.

`userAgent.js` UAParser қолданады; browser/OS белгісіз болса Unknown, device анықталмаса Desktop. `geoip.js` `::ffff:` префиксін алып, `::1`-ді `127.0.0.1`-ге lookup үшін түрлендіреді. Click.ip бастапқы IP күйінде сақталады. Local/private IP-ге GeoIP табылмаса country Unknown, city null — бұл қалыпты жағдай.

Тек string `utm_source`, `utm_medium`, `utm_campaign` (≤500) сақталады. Token және басқа query fields job-қа кірмейді. Referer-ден credentials/query/fragment алынады; origin/path қалады. User-Agent ≤2048, IP processor-де ≤100 таңба.

Барлық analytics endpoint account JWT және ownership тексерісін қолданады:

| Endpoint | Нәтиже |
| --- | --- |
| `GET /api/links/:id/stats` | Lifetime totalClicks = max(Redis, DB), DB-дегі distinct IP және соңғы Click уақыты. |
| `GET /api/links/:id/clicks` | DB Click тізімі, newest-first; page/limit, default 1/20. |
| `GET /api/links/:id/analytics?days=30` | Белгіленген уақыттағы total/unique және browser/OS/device/country/day/hour топтары. |
| `GET /api/analytics/overview?days=30` | Өз Link саны, status ACTIVE саны, кезеңдегі Click саны, lifetime DB clickCount бойынша top 5 Link. |

`groupBy` бір field бойынша бірдей Click-терді санайды. Browser/OS/device/country үшін ең үлкен 10 топ беріледі. `byDay` SQL `DATE(clickedAt)`, `byHour` SQL `EXTRACT(HOUR...)` қолданады; сағаттар барлық кезеңнің 0–23 сағаттарына біріктіріледі. Click жоқ buckets response-та болмайды.

Unique visitors нақты code-та `COUNT(DISTINCT "ip")::int` арқылы есептеледі. `$queryRaw` tagged template мәндерді параметрлейді. Бір IP бірнеше адамға ортақ болуы немесе бір адам IP ауыстыруы мүмкін, сондықтан бұл «бірегей адамдардың дәл саны» емес. Worker кезегі себепті saved analytics live Redis санынан қалып қоюы мүмкін.

`days`: 1–365; page: 1–1000000; limit: 1–100. Pagination: `skip = (page - 1) * limit`, `totalPages = Math.ceil(total / limit)`.

## 15. QR Code

```text
POST /api/links/:id/qr → ownership → BASE_URL/slug
  → qrcode.toBuffer → PNG → uploads/qr/qr-<UUID>.png
  → guarded Prisma updateMany → Link.qrCodeUrl
  → ескі QR cleanup → { qrUrl, shortUrl, fileName }
  → GET /uploads/qr/<fileName> → Express static
```

Default size 512, шегі 128–2048; dark/light color `#RRGGBB`; errorCorrection H, margin 2. `Number.EPSILON` width түзетуі floating-point rounding-тен өлшемнің 1 пиксельге кішіреюін өтейді.

`updateMany` id/userId/slug/бұрынғы qrCodeUrl әлі сәйкес пе, соны тексереді. Қатар generation немесе slug edit нәтижені өзгертіп үлгерсе 409; жаңа файл тазаланады. DB сақтау қате болса да жаңа файл тазаланады. Сәтті replacement ескі файлды жояды; Link delete/slug rename де cleanup шақырады.

`utils/qrFiles.js` — осы cleanup-тың ортақ қауіпсіз utility-і. `QR_DIRECTORY` нақты абсолюттік папканы береді; `getQRFilePath()` тек BASE_URL origin-індегі `/uploads/qr/qr-...png` URL-ін қабылдап, resolved path сол папкада қалатынын тексереді. `removeQRFile()` тек осы файлды unlink жасайды; жоқ файл қалыпты, басқа қате warning. Бұл барлық uploads-ты аралап өшіретін тазалаушы емес. BASE_URL өзгерсе бұрынғы басқа origin URL-іне cleanup қолданылмайды.

Backend QR always backend shortUrl-ді кодтайды. Backend қорғалған сілтемеге password HTML бет бермейді: token жоқ GET 401 JSON береді; пароль UI клиенттің міндеті.

## 16. Admin

`GET /api/admin/links` → account JWT → auth → admin (`role === "ADMIN"`) → pagination validator → adminController → Prisma transaction (all Links + count) → 200.

Default limit 20, max 100. Link пен owner-дің тек safe fields-і `select` арқылы алынады; екі password hash та response-қа кірмейді. Қалыпты Link/Analytics API-дің ownership ережесі ADMIN үшін де сақталады.

401 — жарамды authentication жоқ. 403 — authentication бар, бірақ осы әрекетке рөлі жеткіліксіз.

## 17. Security

| Механизм | Нақты қолданылуы |
| --- | --- |
| Helmet / Express header | Қауіпсіздік headers; `x-powered-by` өшірілген. Development CSP forced HTTPS upgrade қолданбайды. |
| CORS | CLIENT_URL origins және BASE_URL; development-та loopback origins қосымша рұқсат. Рұқсатсыз origin-ге permissive CORS header жоқ; бұл JWT орнына жүрмейді. |
| Rate limiting | IP бойынша API 300/15 min, auth 20/15 min, redirect 200/min, verify қосымша 20/15 min. 429 JSON; auth general API лимитіне де кіреді. |
| Validation | UUID, slug, single query values, integer bounds, HTTP(S), password UTF-8 bytes және QR параметрлері. |
| JWT / bcrypt | HS256 + expiry/claims; 10-round bcrypt, парольдер response-та жоқ. |
| Ownership / allowedFields | Private сұраулар id+userId тексереді; client өзін басқа user-ге байлай алмайды. |
| Error masking | Ішкі details/stack response-та жоқ; validation submitted value-ді қайтармайды. |
| Request size | JSON/urlencoded body 100kb; үлкен body 413. |
| QR path restriction | Cleanup тек generated файлдарды өңдейді; барлық uploads жарияланбайды. |
| Proxy config | req.ip үшін тек конфигурацияланған trusted proxy-ге сену. |

Limiter counters Redis-те емес, process memory-де; restart кезінде тазаланады, бірнеше API instance ортақ limit ұстамайды. Test режимі әдетте limiting-ті өткізіп жібереді; security тесті 429-ды тексеру үшін оны уақытша қосады.

JWT logout-та revoked болмайды; expiry/role DB-дегі өзгерістер account token-ге бірден жазылмайды. `.env` құпия мәндері бұл конспектке көшірілген жоқ.

## 18. Logger

`utils/logger.js` ортақ Winston logger жасайды. Morgan Route **үлгісін** (`/:slug`, `/api/links/:id` сияқты), method, status, response time береді; actual query/body/authorization логталмайды. Unmatched route `[unmatched]` деп жазылады.

`logs/error.log` — errors; `logs/combined.log` — info және одан жоғары levels. File transport JSON форматында, maxsize 5 MB/maxFiles 5; timestamp бар. Development console simple, production console JSON. Test режимінде logger silent және file transport жасалмайды. Logger level info болғандықтан Worker-дің completed debug жазбасы әдепкіде шықпайды.

`redact()` password/secret/token/auth/cookie және connection URL fields-ін, JWT тәрізді мәтіндерді, белгілі env secrets-ті жасырады. Error object name/code-қа қысқарады. Password, JWT, DB/Redis connection string, request body және referrer token логқа түспеуі керек. Мұнда logger файлы бұрын бос болған; жалғастыруда нақты implementation толтырылған.

## 19. Error handling

`AppError(message, statusCode)` — күтілетін бизнес қатесі; `isOperational = true`. `notFoundHandler` сәйкес Route табылмаса 404 AppError береді. Controller catch ішінде `next(error)` шақырады.

```text
throw new AppError("Link not found", 404)
      → Controller catch → next(error) → errorHandler
      → 404 { "success": false, "error": "Link not found" }
```

Handler mappings: P2002 → 409; P2025 → 404; malformed JSON → 400; oversized body → 413; PrismaClientValidationError → 400. Unexpected error → 500 `Internal Server Error`; operational 503 → `Service unavailable`. 5xx errors Winston-ға safe metadata-мен жазылады. Headers жіберіліп қойса, error келесі handler-ге беріледі.

Қазіргі `errorHandler` development/production үшін бөлек response жасамайды: екі режимде де ішкі error message және stack жасырылған. Режим бойынша айырмашылық logging форматында және config/CORS/CSP ережелерінде бар.

## 20. Health / Readiness / Graceful Shutdown

`GET /health` HTTP app жауап бере алатынын көрсетеді, DB/Redis тексермейді. `GET /ready` PostgreSQL `SELECT 1` және Redis `PING` қатар орындайды (әр күту ≤3 секунд), shutdown flag-ты қарайды; healthy 200, failure/shutdown 503, `Cache-Control: no-store`. Worker backlog немесе failed jobs бұл endpoint-пен толық тексерілмейді.

```text
SIGINT / SIGTERM
  → shuttingDown flag
  → HTTP close; idle connections close; 5 s кейін қалғанын force close
  → Worker және Queue close (active jobs аяқталуын күту)
  → Prisma disconnect және Redis quit/disconnect
  → normal completion; жалпы 15 s deadline асса process.exit(1)
```

Worker duplicate Redis-ін өз close wrapper-і жабады. Shutdown қайта шақырылса ортақ Promise пайдаланылады. `withTimeout()` күтуге шек қояды, underlying operation-ды автоматты cancel жасамайды.

## 21. Swagger

OpenAPI — endpoint-тердің method/path, input, output, authentication және errors-ін сипаттайтын формат. Нақты config: `src/docs/openapi.js`, OpenAPI 3.0.3. Бөлек root `docs/` папкасы жоқ.

`/api-docs` — Swagger UI; `/api-docs.json` — машиналық JSON. Authorize-ға account JWT енгізіледі, `persistAuthorization: false`. Try it out нақты backend-ке сұрау жібереді; сондықтан UI арқылы жасалған POST/PATCH/DELETE шын деректерді өзгертеді. OpenAPI validation-дың орнына емес, API-дің құжаты ретінде қызмет етеді.

## 22. Docker

`Dockerfile` Node 22 Debian slim multi-stage image жасайды: locked npm install → Linux ішінде Prisma generate → dev dependencies prune → non-root node user → `node server.js`. Build URL — тек placeholder; нақты DB-ге қосылмайды. Image healthcheck `/ready` шақырады. Startup migration орындамайды.

`docker-compose.yml`: PostgreSQL 16, Redis 7 және optional `api` profile. PostgreSQL/Redis healthchecks бар; API олар healthy болған соң қосылады. Host ports тек `127.0.0.1`-ге байланған. Redis `noeviction` қолданады, бұрынғы RDB persistence режимі ауыстырылмаған. Бұл sudden failure-де еш дерек жоғалмайды деген кепілдік емес.

| Volume | Не сақтайды |
| --- | --- |
| `postgres_data` | PostgreSQL деректері. |
| `redis_data` | Redis persistence деректері. |
| `api_uploads` | API контейнері жасаған QR файлдары. |
| `api_logs` | API контейнерінің log файлдары. |

`.dockerignore` secrets, node_modules, logs, uploads, tests/tooling-ті build context-тен алып тастайды. API container ішінде DB hostname `postgres`, Redis hostname `redis`; host-та іске қосылған API әдетте localhost қолданады. Existing PostgreSQL volume үшін `.env` credentials-ті өзгерту DB role password-ты автоматты өзгертпейді.

Терминал workflow: дайын PostgreSQL/Redis қызметтері → backend папкасында `npm run dev` (немесе `npm start`). API-ді Docker-ге салу міндетті емес; бұл бөлім репозиторийдегі optional setup-ты түсіндіреді. `down -v` data volumes-ті жоятындықтан оқу үшін оны орындамаңыз.

## 23. Tests

Jest Node environment-та `tests/**/*.test.js` файлдарын табады; setup shared env дайындайды. Supertest exported Express app-ты тексереді, `server.js` толық server/Worker startup-ты автоматты қоспайды. Детерминдік тесттер real Controllers/Services/JWT/bcrypt-ті, бірақ DB/Redis/Queue doubles-ті қолданады.

### `tests/auth.test.js`

Register/hash/token/profile, duplicate email, validation, login, missing/expired/redirect JWT rejection және logout response.

### `tests/links.test.js`

CRUD, generated/custom slug, uniqueness, invalid fields/query, ownership, pagination, password hiding, update/cache және toggle/delete.

### `tests/redirect.test.js`

302/cache/queue, 404/410, parallel maxClicks, slug rename budget, protected link JWT, sanitized payload және queue failure reservation.

### `tests/analytics.test.js`

Live stats/distinct IP, click pagination/UTM, grouped/time analytics, owner overview, days validation және Processor retry-де duplicate counting болмауы.

### `tests/admin.test.js`

401/403, ADMIN cross-user listing/pagination, password hiding және normal API ownership ADMIN-ға да қолданылуы.

### `tests/qr.test.js`

PNG signature/өлшем/static serving, replacement/delete cleanup, invalid options және unsafe/foreign QR URL rejection. Нақты файлдар жасалады; тест өзі қайтарған URL-дерді ғана тазартады.

### `tests/security.test.js`

Helmet, readiness failure, CORS, malformed/oversized JSON, secret-free validation/error responses, Prisma error mapping, Swagger және auth limit 429.

### `tests/env.test.js`

Missing/separate test DB, production JWT secret, port/origin validation; қате config messages secrets-ті қайталамайтынын тексереді.

### `tests/postgres.integration.test.js`

Тек арнайы `TEST_DATABASE_URL` берілсе real PostgreSQL-де auth/CRUD/ownership/redirect/SQL aggregates/idempotency тексереді. Redis/Queue көп тексеруде mocks. `TEST_REDIS_URL` де берілсе random test Queue-мен real BullMQ delivery → PostgreSQL Click тексерісі қосылады.

### `tests/redis.integration.test.js`

Тек `TEST_REDIS_URL` берілсе real Redis Lua-ны 50 concurrent request-пен, counter жоғалғанда DB baseline қолданылуын тексереді; DB mock.

**Supporting files:** `setup.js` test URL-дерді бөлек белгілейді; `helpers.js` mocks/fixtures/tokens береді; `support/database.js` in-memory Prisma query double; `support/redis.js` in-memory Redis/Lua double. Doubles real PostgreSQL constraints/transactions/Redis concurrency-дің толық орнына жүрмейді.

**Development дерегін қорғау:**

1. App config және Prisma CLI test режимінде тек `TEST_DATABASE_URL` таңдайды; development DB-ге fallback жоқ.
2. Test DB атауында delimited `test` және development-тен басқа name талап етіледі.
3. Opt-in URL жоқ integration suite skipped болады. Dummy unit URLs connection-ға емес, mocks-ке арналған.
4. PostgreSQL cleanup тек UUID email-мен осы тест құрған users-ті және cascade records-ін жояды; reset/truncate жоқ.
5. Redis cleanup тек UUID fixture keys-ті жояды; FLUSHDB/FLUSHALL жоқ. Real BullMQ тесті тек өзі құрған `codex-test-<UUID>` Queue-ды жояды, production `analytics` Queue-ды емес.
6. QR cleanup барлық uploads-ты араламайды; дәл осы тесттің URL-дерін тазартады.

`test-db.js` Jest suite емес: real configured DB-ге қосылып, Redis-ке `test=working` жазады. Сондықтан оны read-only тексеріс деп санауға болмайды. Осы құжаттау тапсырмасында еш тест іске қосылмады, жаңа pass count айтылмайды.

## 24. Request мысалдары

### Register flow

`POST /api/auth/register` → API + auth limit → JSON parser → registerValidator → validate → authController → authService → bcrypt → Prisma User → JWT → 201 safe user/token.

### Create Link flow

Bearer JWT → `/api/links` auth → create validator → validate → linkController → linkService → generated/custom slug → optional hash → PostgreSQL Link → 201 safe Link/shortUrl.

Мысал body: `{ "originalUrl": "https://example.com/article", "slug": "my-article", "tags": ["study"] }`.

### Redirect + Analytics flow

`GET /my-article?utm_source=course` → redirect limit/validation → Redis/DB Link → restrictions → atomic reservation → UUID analytics job → Queue add → 302. Оған тәуелсіз Worker job-ты алып UA/GeoIP → transaction → Click және DB count жаңартады.

Response және Worker аяқталуының реті «міндетті түрде алдымен 302, одан кейін Worker» емес: request Worker нәтижесін күтпейді.

## 25. Әр файлды қалай жаттап аламын?

Файлды бір сөйлеммен айтып, артынан «кім шақырады, қандай input алады, не қайтарады?» деп қайталаңыз. Төменде барлық project-owned JS файлдары және маңызды Prisma config берілген.

| File | Бір сөйлеммен қызметі |
| --- | --- |
| `server.js` | Dependency startup пен HTTP/Worker graceful shutdown-ды басқарады. |
| `jest.config.js` | Jest discovery, setup, timeout және coverage параметрлерін береді. |
| `test-db.js` | DB connection мен нақты Redis write/read-ті қолмен тексеретін script. |
| `prisma7.config.ts` | Prisma CLI schema/migration/DB URL және test DB guard config-і. |
| `prisma/seed.js` | Қазір бос seed placeholder. |
| `src/app.js` | Express Middleware, docs, static және барлық Route-тарды ретімен жалғайды. |
| `src/config/env.js` | Environment мәндерін оқып, fail-fast validation жасайды. |
| `src/config/database.js` | PostgreSQL adapter-і бар ортақ PrismaClient береді. |
| `src/config/redis.js` | API/Queue үшін bounded Redis connection береді. |
| `src/routes/authRoutes.js` | Register/login/me/logout бағыттарын жалғайды. |
| `src/routes/linkRoutes.js` | JWT қорғалған Link CRUD/toggle/QR бағыттарын жалғайды. |
| `src/routes/redirectRoutes.js` | Public redirect/verify бағыттарына limiter/validator қояды. |
| `src/routes/analyticsRoutes.js` | JWT қорғалған stats/clicks/analytics/overview бағыттарын жалғайды. |
| `src/routes/adminRoutes.js` | Auth + ADMIN + pagination арқылы барлық Link listing-ін береді. |
| `src/controllers/authController.js` | Auth Service нәтижесін JSON-ға айналдырады және logout жауап береді. |
| `src/controllers/linkController.js` | Link/QR Services шақырып, HTTP жауап береді. |
| `src/controllers/redirectController.js` | Sanitized analytics job кезекке салып, 302 немесе verify token береді. |
| `src/controllers/analyticsController.js` | Stats/clicks/analytics/overview Service нәтижесін JSON-ға орайды. |
| `src/controllers/adminController.js` | Prisma арқылы safe cross-user Link listing/pagination орындайды. |
| `src/services/authService.js` | Registration/login/profile бизнес ережелерін орындайды. |
| `src/services/linkService.js` | Link CRUD/ownership, safe output, cache/counter және QR lifecycle-ді басқарады. |
| `src/services/redirectService.js` | Cached Link, restrictions, password verification және atomic click reservation орындайды. |
| `src/services/analyticsService.js` | Ownership-тен кейін lifetime/period SQL және Prisma aggregates жасайды. |
| `src/services/qrService.js` | Owned Link үшін PNG жасап, guarded DB save/replacement орындайды. |
| `src/middleware/auth.js` | Account Bearer JWT claims-ін тексеріп, req.user орнатады. |
| `src/middleware/admin.js` | req.user.role ADMIN екенін тексереді. |
| `src/middleware/validate.js` | Validation errors-ін submitted values жоқ 400 JSON-ға айналдырады. |
| `src/middleware/rateLimiter.js` | Төрт IP limiter жасайды. |
| `src/middleware/errorHandler.js` | 404 және басқа errors-ті қауіпсіз біркелкі JSON-ға айналдырады. |
| `src/validators/authValidator.js` | Registration/login fields-ін тексереді. |
| `src/validators/linkValidator.js` | Link CRUD/query, slug/token, password және QR параметрлерін тексереді. |
| `src/validators/analyticsValidator.js` | UUID, days, page, limit параметрлерін тексереді. |
| `src/queues/analyticsQueue.js` | track-click job-тарын retry/retention бар analytics Queue-ға қабылдайды. |
| `src/queues/analyticsWorker.js` | Job-тарды Processor-ға беріп, өз Redis connection-ын жабады. |
| `src/utils/AppError.js` | HTTP status-ы бар operational Error жасайды. |
| `src/utils/bcrypt.js` | Password hash пен compare функцияларын береді. |
| `src/utils/jwt.js` | Account/redirect JWT шығарып, HS256 тексереді. |
| `src/utils/slugGenerator.js` | Crypto random және DB uniqueness арқылы slug жасайды. |
| `src/utils/userAgent.js` | User-Agent-тен browser/OS/device шығарады. |
| `src/utils/geoip.js` | IP normalization және country/city lookup орындайды. |
| `src/utils/logger.js` | Secrets-ті жасыратын console/file Winston logger береді. |
| `src/utils/analyticsProcessor.js` | Metadata sanitization және idempotent Click/count transaction орындайды. |
| `src/utils/qrFiles.js` | Generated QR URL-ін қауіпсіз file path-қа айналдырып, қажет файлды жояды. |
| `src/utils/withTimeout.js` | Async операцияны күтудің уақытын шектейді. |
| `src/docs/openapi.js` | Endpoint/schema/security/error OpenAPI сипаттамасын береді. |
| `tests/setup.js` | Test environment және opt-in integration URLs дайындайды. |
| `tests/helpers.js` | Shared mocks, fixtures, auth token және in-memory reset береді. |
| `tests/support/database.js` | Prisma query boundary-ді memory-де имитациялайды. |
| `tests/support/redis.js` | Redis keys/counters/Lua boundary-ді memory-де имитациялайды. |
| `tests/auth.test.js` | Auth HTTP flow-ларын тексереді. |
| `tests/links.test.js` | Link CRUD/validation/ownership/cache әрекеттерін тексереді. |
| `tests/redirect.test.js` | Redirect restrictions/queue/token/live budget әрекеттерін тексереді. |
| `tests/analytics.test.js` | Analytics жауаптары мен retry idempotency-ді тексереді. |
| `tests/admin.test.js` | ADMIN access және safe listing-ті тексереді. |
| `tests/qr.test.js` | Нақты PNG lifecycle мен path guard-ты тексереді. |
| `tests/security.test.js` | Headers/CORS/errors/readiness/rate limit/docs тексереді. |
| `tests/env.test.js` | Config validation және test DB guard-тарды тексереді. |
| `tests/postgres.integration.test.js` | Арнайы DB-де real persistence/SQL және optional BullMQ delivery тексереді. |
| `tests/redis.integration.test.js` | Арнайы Redis connection-да real Lua concurrency тексереді. |

## 26. Backend-ті толық бір сөйлеммен түсіндіру

«Бұл backend Express арқылы сұрауларды қабылдайды, JWT пен validation арқылы рұқсатты тексереді, Prisma 7 PostgreSQL-де users/links/clicks сақтайды, Redis қысқа сілтемелерді кэштеп өту лимитін атомарлы резервтейді, ал BullMQ Worker аналитиканы қайталап санамай фондық режимде өңдейді».

### Бір минуттық қорғау нұсқасы

«Менің жобам — URL Shortener және Analytics backend. Пайдаланушы тіркеліп, JWT арқылы кіргеннен кейін ұзын URL-ге қысқа slug жасайды. Оның сілтемелерін тек өзі өзгерте алады; ADMIN-ға барлық пайдаланушылардың сілтемелерін көруге арналған бөлек endpoint бар. Password bcrypt hash ретінде сақталады. Public қысқа URL ашылғанда backend алдымен Redis кэшін, қажет болса PostgreSQL-ді қарайды, disabled күйін, мерзімді, өту лимитін және пароль token-ін тексереді. Redis Lua соңғы бос өту орнын атомарлы резервтейді. Analytics job Queue-ға қабылданған соң браузерге 302 беріледі. Worker User-Agent пен IP-ден құрылғы/геодеректерді анықтап, Click пен count-ты бір transaction-да сақтайды; retry бір click-ті екі рет санамайды. Жоба QR PNG, статистика, Swagger, logging, readiness және graceful shutdown қамтиды. Тесттер development DB-ді пайдаланбайды: mocks немесе арнайы test DB/Redis connection қолданылады».
