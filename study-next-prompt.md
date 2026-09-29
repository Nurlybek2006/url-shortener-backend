# Backend Continuation — What VS Code AI Changed

Бұл файл бүкіл жобаны қайта түсіндірмейді: бұрынғы backend пен жалғастырудан кейінгі backend айырмасын үйретеді. Толық конспект: [study.md](study.md).

**Git дәлелі:** тексеру басында `git status --short`, `git diff`, `git diff --cached` бос болды. Өзгерістер қазір working tree-де M/?? болып тұрған жоқ, `c245a34` commit-іне сақталған. Салыстыру: оның тікелей ата-анасы `1394dfc` → `c245a34` (`HEAD`). Бұл аралықта **51 файл: 13 A (added), 38 M (modified), 2504 қосылған және 331 алынған жол**.

Git файлдың қосылғанын/өзгергенін дәлелдейді, бірақ әр жолды AI немесе адам жазғанын жеке дәлелдемейді. Commit author — пайдаланушы аккаунты. Сондықтан төмендегі «AI өзгерістері» осы сессиядағы жалғастырумен сәйкес келетін commit diff-ін білдіреді; Git арқылы жеке авторлықты абсолютті анықтау мүмкін емес.

`study.md` және осы файл — осы құжаттау тапсырмасында жасалған екі жаңа файл; жоғарыдағы тарихи 51 файлға кірмейді. Еш application code, package, schema немесе runtime config өзгертілмеді.

## 1. Бастапқы күй

`1394dfc` ішінде мына мүмкіндіктердің **коды бар болған**; бұл олардың бәрі бұрын толық тесттен өткен деген дәлел емес:

| Бұрын болған бөлік | Git/source дәлелі |
| --- | --- |
| Auth: register/login/me/logout, bcrypt/JWT | `authRoutes`, `authController`, `authService`, `auth`, `jwt`, `bcrypt` файлдары бар. |
| Link CRUD, ownership, safe password output | `linkRoutes`, `linkController`, `linkService`; allowedFields және `formatLink` бұрыннан бар. |
| Random/custom slug | `slugGenerator` және Link validation/service бұрыннан бар. |
| Redirect, Redis cache/counter | `c235402` commit-і және бұрынғы `redirectService`. |
| BullMQ + UA/GeoIP analytics | `b6cf386`, Queue/Worker/User-Agent/GeoIP utilities. |
| Analytics API, distinct IP SQL | `ed5f3dd`, бұрынғы `analyticsService` ішіндегі COUNT(DISTINCT ip). |
| Protected link, temporary JWT | `e65798f`, бұрынғы verify flow және redirect token generator. |
| QR generation | `bea412d`, `qrService` және QR validator/endpoint. |
| Admin listing | `1394dfc`, `adminRoutes`/`adminController`. |
| Prisma 7 PostgreSQL adapter/schema | Client/adapter/config және User/Link/Click models бұрыннан бар. |
| PostgreSQL/Redis Compose | Бұрыннан екі service және persistent volumes бар. |

Маңызды бастапқы бос файлдар: `Dockerfile`, `README.md`, `jest.config.js`, `src/middleware/rateLimiter.js`, `src/utils/logger.js`, `tests/setup.js` және auth/links/redirect/analytics `.test.js` файлдары. Diff-тегі `e69de29` бос blob және 0 removed lines соны растайды. Бұлар **жаңа файл емес**, бұрынғы placeholder-лер толтырылған.

Бастапқы мәселенің мысалдары: Redis лимитін бөлек тексеру/increment concurrency кезінде артық өтуге жол берді; retry жаңа Click жасап қайта санай алатын; QR ауысқанда ескі файл қалған; `redirectService` ішінде `verifyToken()` шақырылып, импортталмаған. Жалғастыру жаңа жоба жасаған жоқ, осы негізді аяқтап/нақтылаған.

## 2. AI не істеді?

| Санат | Нақты өзгеріс |
| --- | --- |
| Security | JWT algorithm/claims, URL credentials restriction, reserved slugs, bytes/type/query bounds, origin-aware CORS, 100kb body limit. |
| Error handling | Operational AppError, Prisma/body-parser mappings, secret-free validation және ішкі details/stack masking. |
| Logger | Бос logger толтырылып, Morgan/Redis/Worker/server logs Winston-ға біріктірілді; secrets redaction қосылды. |
| Rate limiter | Бос файлда API/auth/redirect/password төрт limiter жасалып, тиісті жерге жалғанды. |
| Redirect/counter | Missing JWT import түзетілді; atomic Redis Lua reservation, DB baseline recovery және rename counter transfer қосылды. |
| Analytics | Sanitized payload/time/UUID, бөлек Processor, idempotent transaction, deleted-Link handling; stats max(Redis, DB). |
| QR lifecycle | Safe utility, UUID filename, exact size correction, concurrent update guard, replacement/rename/delete cleanup. |
| Environment | Fail-fast URL/port/secret/proxy checks және app/Prisma CLI-де бөлек test DB guard. |
| Startup/shutdown | Redis/Queue/Worker ready күту, bounded shutdown және resource close. |
| Health | Бұрынғы health сақталып, DB/Redis readiness қосылды. |
| Swagger | OpenAPI source + UI/JSON endpoint + бір жаңа runtime dependency. |
| Docker | Бос Dockerfile толтырылды; Compose credentials env-ке көшірілді, healthchecks/loopback/noeviction/optional API profile қосылды. |
| Tests/docs | Бос tests/config толтырылды; жаңа suites/doubles/fixtures, README және test safety түсіндірмесі қосылды. |
| Package config | Prisma scripts explicit config қолданады; test/coverage/integration/deploy scripts, engines және екі scoped override қосылды. |

Төменде өзгерістердің толық файлдық тізімі берілген. Өзгермеген мүмкіндікті «жаңадан жасалды» деп есептемеңіз.

## 3. Жаңа файлдар

Төмендегі **13 файл** салыстырылған commit-те `A` болған. **Қазіргі Git status: tracked/committed; untracked/new емес.** Жаңа құжаттардан бұрын working tree таза болғандықтан тарихи файлдарға `??` белгісін қолдану дұрыс емес.

### `src/docs/openapi.js`

**Неге қосылды:** API-ді payload, authentication және errors бойынша оқуға/сынауға арналған ортақ сипаттама қажет болды.

**Не істейді:** OpenAPI 3.0.3 object, барлық endpoint paths, reusable schemas, responses және Bearer scheme береді.

**Қай файлдар шақырады:** `src/app.js` JSON және Swagger UI ретінде жариялайды.

**Маңызды функциялар:** `ref`, `parameter`, `object`, `envelope`, `response`, `errors`, `listParameters`; экспорт — OpenAPI object. Git change: A.

### `src/utils/analyticsProcessor.js`

**Неге қосылды:** бұрын Worker ішіндегі parsing/DB жұмысын жеке тексерілетін және retry-ге төзімді функцияға бөлу үшін.

**Не істейді:** UTM/referrer тазалайды, click timestamp/metadata алады, бір тұрақты ID арқылы duplicate-ті өткізіп, Click+increment transaction орындайды. Ескі job-тарға ID fallback бар.

**Қай файлдар шақырады:** `redirectController` sanitization helpers; `analyticsWorker` Processor; analytics/PostgreSQL tests.

**Маңызды функциялар:** `scalar`, `sanitizeReferer`, `analyticsQuery`, `getClickId`, `processAnalyticsJob`; `scalar` мен `getClickId` — ішкі helpers. Экспорттар: `processAnalyticsJob`, `analyticsQuery`, `sanitizeReferer`. Git change: A.

### `src/utils/qrFiles.js`

**Неге қосылды:** QR replacement/delete/rename cleanup бір қауіпсіз ережемен орындалуы үшін.

**Не істейді:** URL origin/path/generated filename және resolved directory тексереді; рұқсат етілген PNG-ді ғана өшіреді, жоқ файлды қалыпты қабылдайды.

**Қай файлдар шақырады:** `linkService.js`, `qrService.js`, `tests/qr.test.js`.

**Маңызды функциялар:** `getQRFilePath()`, `removeQRFile()`; constant `QR_DIRECTORY`. Git change: A.

### `src/utils/withTimeout.js`

**Неге қосылды:** dependency readiness және shutdown күтуі шексіз созылмас үшін.

**Не істейді:** operation мен timer-ді `Promise.race` арқылы күтеді; timer-ді finally тазалайды. Операцияның өзін cancel жасамайды.

**Қай файлдар шақырады:** `server.js`, `src/app.js`.

**Маңызды функция:** `withTimeout(operation, milliseconds)`. Git change: A.

### `tests/admin.test.js`

**Неге қосылды:** USER/ADMIN шекарасы, cross-user listing және password hiding-ті тексеру үшін.

**Не істейді:** 401/403, ADMIN pagination, safe owner fields және private API ownership assertions.

**Қай файлдар шақырады:** Jest discovery; shared `helpers.js` импорттайды.

**Маңызды функциялар:** Jest `test()` callbacks; жеке public function жоқ. Git change: A.

### `tests/env.test.js`

**Неге қосылды:** қате config пен development DB-ге test fallback жасалмауын жеке тексеру үшін.

**Не істейді:** isolated module/env ішінде config errors-ін, test DB name, production JWT/port/origin guards-ті қарайды; dotenv mock.

**Қай файлдар шақырады:** Jest discovery.

**Маңызды функция:** `inspectEnv(overrides)` және `test`/`test.each` callbacks. Git change: A.

### `tests/helpers.js`

**Неге қосылды:** endpoint tests бірдей қауіпсіз doubles/fixtures қолдануы үшін.

**Не істейді:** Prisma/Redis/Queue/logger mocks жалғайды, app және in-memory fixtures, JWT береді.

**Қай файлдар шақырады:** auth, links, redirect, analytics, admin, qr, security tests.

**Маңызды функциялар:** `user()`, `link()`, `authorization()`, `reset()`; reset тек memory arrays/maps-ті тазалайды. Git change: A.

### `tests/postgres.integration.test.js`

**Неге қосылды:** memory double нақты SQL/constraints/persistence-ті дәлелдей алмайды.

**Не істейді:** explicit test DB-де real app/service persistence тексереді; екі test URL барда real BullMQ worker check қосылады. Өз fixture users-ін ғана cascade cleanup жасайды.

**Қай файлдар шақырады:** Jest discovery және `npm run test:integration`; real config/Prisma/Processor, mock Redis/Queue қолданады.

**Маңызды функциялар:** local `register()`, `createLink()`, BullMQ check ішіндегі `connection()`; beforeAll/afterAll callbacks. Git change: A.

### `tests/qr.test.js`

**Неге қосылды:** QR файл lifecycle-і мен path safety-ді нақты filesystem-де тексеру үшін.

**Не істейді:** PNG signature/256px/static/replacement/delete, invalid options, traversal/foreign URL rejection; тек өзі алған URLs cleanup.

**Қай файлдар шақырады:** Jest discovery; helpers және qrFiles импорттайды.

**Маңызды функциялар:** local `generate()` callback, tests және `afterEach` cleanup. Git change: A.

### `tests/redis.integration.test.js`

**Неге қосылды:** Lua-ның атомарлы мінезін mock емес, нақты Redis-пен тексеру үшін.

**Не істейді:** 50 simultaneous reservation және жоғалған counter baseline; тек random UUID keys-ті жояды.

**Қай файлдар шақырады:** Jest discovery және integration script; real Redis, mock DB, redirectService.

**Маңызды функция:** local `target(overrides)` және test/setup/cleanup callbacks. Git change: A.

### `tests/security.test.js`

**Неге қосылды:** security/error/readiness behavior-ды HTTP деңгейінде бекіту үшін.

**Не істейді:** headers/CORS/413/400/redaction/error mappings/Swagger/429 тексереді.

**Қай файлдар шақырады:** Jest discovery; helpers және errorHandler қолданады.

**Маңызды функциялар:** `test()` callbacks; жеке exported function жоқ. Git change: A.

### `tests/support/database.js`

**Неге қосылды:** негізгі tests real DB-ге қосылмай Controllers/Services-ті тексеруі үшін.

**Не істейді:** User/Link/Click memory rows, select/filter/order/pagination, basic query/grouping және mock Prisma methods.

**Қай файлдар шақырады:** `tests/helpers.js`, `tests/redis.integration.test.js`.

**Маңызды функциялар:** `matches()`, `project()`, `query()`, `insert()`, exported db methods және `db.reset()`. SQL transaction/constraints-тің толық эмуляторы емес. Git change: A.

### `tests/support/redis.js`

**Неге қосылды:** негізгі tests configured Redis-ке write жасамай cache/counter flow тексеруі үшін.

**Не істейді:** Map ішіндегі get/set/del/counters және осы жобаның Lua script behavior mock-тары.

**Қай файлдар шақырады:** `tests/helpers.js`, `tests/postgres.integration.test.js`.

**Маңызды функциялар:** exported `get/set/del/eval/duplicate/reset` mocks. Real Redis concurrency-ді бөлек suite тексереді. Git change: A.

## 4. Өзгертілген файлдар

Бұл бөлімде тарихи **38 M файлдың бәрі** қамтылған. «Бұрынғы» — `1394dfc`, «жаңа» — `c245a34`; қазіргі documentation turn-де олар қайта өзгертілген жоқ.

### `.dockerignore`

**Бұрынғы мақсаты:** dependency/env/Git/uploads сияқты жергілікті файлдарды build context-тен шығару.

**Не өзгерді:** tooling, tests, test-db/Jest config, logs, uploads, key/pem және temp exclusions кеңейді; `.env.example` exception алынды.

**Неге өзгертілді:** image-ке secrets/runtime/test/tooling деректерін көшірмеу.

**Жаңа flow:** Docker context filter → тек қажетті build source.

### `.env.example`

**Бұрынғы мақсаты:** basic server/DB/Redis/JWT/BASE_URL үлгісі.

**Не өзгерді:** TEST_DATABASE_URL/optional TEST_REDIS_URL, CLIENT_URL/TRUST_PROXY, Compose POSTGRES_* және DATABASE_URL_DOCKER, stronger secret нұсқауы қосылды; secret placeholder мәні алынды.

**Неге өзгертілді:** host/container/test орталарының connection-дарын ажырату.

**Жаңа flow:** үлгі → local `.env` → env validation; нақты құпия мәндер құжатқа көшірілмейді.

### `.gitignore`

**Бұрынғы мақсаты:** dependencies/env/logs/generated files/coverage-ді Git-тен шығару.

**Не өзгерді:** entire `uploads/` exclusion; `.env.*` ignore және `.env.example` exception. Бұрын tracked `.gitkeep` бұдан автоматты untracked болмайды.

**Неге өзгертілді:** runtime QR/env variant-тары commit-ке кездейсоқ кірмеу.

**Жаңа flow:** runtime/generated file → ignore; public env template → tracked.

### `Dockerfile`

**Бұрынғы мақсаты:** Docker image үшін бос placeholder.

**Не өзгерді:** Node 22 slim multi-stage build, npm ci, Linux Prisma generate, prune, non-root runtime және readiness healthcheck.

**Неге өзгертілді:** optional API контейнерін reproducible түрде құру.

**Жаңа flow:** package lock → build/client generation → runtime → server.js. Git M, A емес.

### `README.md`

**Бұрынғы мақсаты:** бос README placeholder.

**Не өзгерді:** setup/env/API/test safety/Docker/operations/limitations туралы 210 жол құжат толтырылды.

**Неге өзгертілді:** проектті қосу мен шектеулерін source оқымай түсінуге көмектесу.

**Жаңа flow:** README → setup/API/test commands; application request flow-ға қатыспайды. Git M.

### `docker-compose.yml`

**Бұрынғы мақсаты:** PostgreSQL 16 + Redis 7, named containers/volumes және host ports.

**Не өзгерді:** DB credentials env-ке көшті; ports loopback; healthchecks; Redis noeviction; optional api profile, dependency gating/init/grace period және uploads/logs volumes.

**Неге өзгертілді:** committed credentials-ті config-тен шығару, dependency readiness және optional deployment беру.

**Жаңа flow:** default postgres/redis; optional profile → healthy dependencies → API. Existing volume/service names және RDB persistence режимі сақталған; PostgreSQL existing role password env ауыстырғанда автоматты өзгермейді.

### `jest.config.js`

**Бұрынғы мақсаты:** бос Jest placeholder.

**Не өзгерді:** Node test environment, tests glob, setupFilesAfterEnv, clearMocks, бір worker, timeout 15s және coverage config.

**Неге өзгертілді:** тесттерді біркелкі, deterministic орындау.

**Жаңа flow:** Jest → setup.js → test files → mocks немесе opt-in integrations. Git M.

### `package.json`

**Бұрынғы мақсаты:** dependencies мен basic npm scripts; main index.js болған.

**Не өзгерді:** main server.js; Prisma scripts explicit config; test runInBand/watch/coverage/integration және prisma:deploy; description/Node engines; swagger-ui-express dependency; scoped deepmerge-ts 8.0.2/mysql2 3.24.4 overrides.

**Неге өзгертілді:** нақты entry/config, тексеру/deployment commands және dependency maintenance.

**Жаңа flow:** npm script → дұрыс CLI/config/entry. Prisma 7 бұрыннан бар; бұл diff MySQL database-ке көшу емес — mysql2 Prisma tooling-тің transitive dependency-і.

### `package-lock.json`

**Бұрынғы мақсаты:** dependency resolution-ды бекіту.

**Не өзгерді:** Swagger packages, engines metadata; deepmerge-ts 7.1.5 → 8.0.2, mysql2 3.15.3 → 3.24.4 және оның dependency айырмасы.

**Неге өзгертілді:** package.json өзгерісіне сай қайталанатын installation.

**Жаңа flow:** npm ci → осы locked versions. Бұл құжаттау turn-де package install/audit орындалған жоқ.

### `prisma7.config.ts`

**Бұрынғы мақсаты:** schema/migrations path және DATABASE_URL беру.

**Не өзгерді:** test mode TEST_DATABASE_URL таңдайды; protocol/name/test component/development name guards қосылды.

**Неге өзгертілді:** Prisma CLI test командасы development DB-ге түспеуі үшін.

**Жаңа flow:** NODE_ENV → тиісті URL → guard → Prisma datasource.

### `server.js`

**Бұрынғы мақсаты:** app/Worker import, DB connect, Redis ping және listen.

**Не өзгерді:** ordered readiness/startup, timeouts, safe logging, exported functions, main guard, signal/fatal failure handlers, bounded shutdown.

**Неге өзгертілді:** dependencies дайынсыз HTTP ашпау және ресурстарды abrupt exit алдында жабу.

**Жаңа flow:** env → DB → Redis → app/Queue/Worker ready → HTTP; stop → HTTP → Worker/Queue → DB/Redis.

### `src/app.js`

**Бұрынғы мақсаты:** Express Middleware/routes/health/static/error wiring.

**Не өзгерді:** origin-aware CORS, trust proxy/CSP config, safe Morgan stream, rate limits, 100kb body limits, ready/docs routes; static path `/uploads`-тан `/uploads/qr`-ға шектелді.

**Неге өзгертілді:** browser/request/log/file exposure ережелерін анықтау және monitoring/docs қосу.

**Жаңа flow:** security/log/limits/parser → health/docs/API/static → public redirect → errors. Нақты API routes public slug-тен бұрын бұрын да тұрған.

### `src/config/database.js`

**Бұрынғы мақсаты:** PrismaPg adapter бар PrismaClient; Prisma 7 setup бұрыннан қолданылған.

**Не өзгерді:** connectionTimeoutMillis 5000 және statement_timeout 10000 қосылды.

**Неге өзгертілді:** DB connection/query күтуді шектеу.

**Жаңа flow:** checked env URL → bounded PostgreSQL adapter → shared PrismaClient.

### `src/config/env.js`

**Бұрынғы мақсаты:** төрт required env variable бар-жоғын тексеріп, values экспорттау.

**Не өзгерді:** NODE_ENV/URL protocols/origins/port/secret/duration/proxy validation; test DB таңдау/guard, CLIENT_URL list, quiet dotenv.

**Неге өзгертілді:** конфигурация қатесін startup-та анықтау және test дерегін оқшаулау.

**Жаңа flow:** `.env` → parse/required → fail немесе normalized config.

### `src/config/redis.js`

**Бұрынғы мақсаты:** ортақ Redis; maxRetriesPerRequest null, console logs.

**Не өзгерді:** API retries 1, 5s connection/command timeouts, offline queue false, Winston name/code logs.

**Неге өзгертілді:** API request-тің Redis reconnect-ті шексіз күтпеуі.

**Жаңа flow:** bounded API/producer Redis; Worker өз duplicate connection-ын бөлек құрады.

### `src/controllers/redirectController.js`

**Бұрынғы мақсаты:** resolveRedirect → job queue → 302, password verify response.

**Не өзгерді:** random clickId/jobId, request-time clickedAt, UA length, sanitized referrer және тек scalar үш UTM field; unused imports алынды.

**Неге өзгертілді:** retry idempotency, analytics уақытын және payload құпиялылығын сақтау.

**Жаңа flow:** reservation → UUID/time + allowlisted metadata → await Queue add → 302. **Token query-ден бұрынғы code-та да бөлініп алынған**; жаңа өзгеріс — қалған барлық query-ді емес, тек UTM-ді өткізу және referrer-ді тазалау.

### `src/middleware/auth.js`

**Бұрынғы мақсаты:** Bearer token verify → req.user; signature/expiry errors.

**Не өзгерді:** strict case-insensitive Bearer regex, whitespace parsing, UUID userId/role/integer exp/purpose guards, NotBeforeError mapping.

**Неге өзгертілді:** дұрыс қолтаңба жалғыз өзі account token құрылымын дәлелдемейді.

**Жаңа flow:** header → JWT verify → account claims → req.user немесе 401.

### `src/middleware/errorHandler.js`

**Бұрынғы мақсаты:** 404 және error.statusCode/error.message response; originalUrl/message details тікелей шығатын.

**Не өзгерді:** operational AppError, generic 404, headersSent guard, Prisma/body parser mapping, 5xx masking және safe logging.

**Неге өзгертілді:** URL token немесе DB/stack details клиентке шықпау.

**Жаңа flow:** error → known mapping → safe JSON. Development та production та stack/message details жарияламайды.

### `src/middleware/rateLimiter.js`

**Бұрынғы мақсаты:** бос Middleware placeholder.

**Не өзгерді:** createLimiter және API/auth/redirect/password limits; draft-8 headers, 429 JSON, test skip.

**Неге өзгертілді:** abuse/brute-force сұрауларын IP бойынша шектеу.

**Жаңа flow:** app/public Route limiter → allowed request немесе 429. Store in-memory, Redis limiter емес. Git M.

### `src/middleware/validate.js`

**Бұрынғы мақсаты:** express-validator errors.array response немесе next.

**Не өзгерді:** uniform error string; errors-тен тек path/location/msg қалды, submitted value шығарылмайды.

**Неге өзгертілді:** validation failure password/token-ді response-қа қайтармауы үшін.

**Жаңа flow:** validationResult → sanitized 400 немесе Controller.

### `src/queues/analyticsQueue.js`

**Бұрынғы мақсаты:** analytics Queue, 3 attempts/exponential backoff/retention.

**Не өзгерді:** Queue error event Winston-ға жазылады.

**Неге өзгертілді:** queue connection failure бақылау.

**Жаңа flow:** Queue error → safe logger. Retry 3/backoff 1000/concurrency емес retention 1000/5000 бұрыннан болған.

### `src/queues/analyticsWorker.js`

**Бұрынғы мақсаты:** inline parsing, Click.create + Link increment transaction; ортақ Redis; concurrency 20.

**Не өзгерді:** processAnalyticsJob-қа delegate; worker-only Redis duplicate/unlimited retries/offline queue; safe event logs; idempotent close wrapper connection-ды жабады.

**Неге өзгертілді:** DB processing-ті жеке тексеру, producer/consumer retry талаптарын ажырату және shutdown leak болдырмау.

**Жаңа flow:** analytics Queue → Worker(connection/concurrency/events) → Processor(transaction/idempotency). Concurrency 20 жаңадан қосылған жоқ.

### `src/routes/adminRoutes.js`

**Бұрынғы мақсаты:** auth/admin → getAllLinks.

**Не өзгерді:** linkListValidator және validate қосылды.

**Неге өзгертілді:** page/limit дұрыс емес мәндерін query жасамай тоқтату.

**Жаңа flow:** auth → admin → pagination → Controller.

### `src/routes/redirectRoutes.js`

**Бұрынғы мақсаты:** public GET redirect және POST password verify; verify password validator болған.

**Не өзгерді:** redirect limiter/validator екі path-та; POST-та password limiter қосымша.

**Неге өзгертілді:** malformed slug/token және brute-force request-терін шектеу.

**Жаңа flow:** limiter(s) → slug/token/body validators → validate → Controller.

### `src/services/analyticsService.js`

**Бұрынғы мақсаты:** ownership, stats/clicks/aggregates/overview.

**Не өзгерді:** stats totalClicks Redis мәнін DB count-тан төмен түсірмейді: `Math.max(Number(redisCount) || 0, link.clickCount)`.

**Неге өзгертілді:** stale/төмен Redis count persisted count-ты басып кетпеуі үшін.

**Жаңа flow:** owned Link + Redis → max live/persisted count. **COUNT(DISTINCT ip), groupBy/byDay/byHour бұрыннан болған**, жаңадан жасалған analytics endpoint емес.

### `src/services/linkService.js`

**Бұрынғы мақсаты:** owned CRUD/toggle, hash hiding, cache invalidation.

**Не өзгерді:** MOVE_COUNTER Lua, slug rename-де counter сақтау және QR null/cleanup; delete-де QR cleanup.

**Неге өзгертілді:** rename maxClicks бюджеті қайта басталмауы және ескі QR ескі slug-ке апармауы үшін.

**Жаңа flow:** DB update → counter move/cache delete → old QR cleanup; delete → DB/caches/counter/QR. Password hashing/allowedFields/ownership бұрыннан бар.

### `src/services/qrService.js`

**Бұрынғы мақсаты:** shortUrl PNG жасау, timestamp filename, file write және DB update.

**Не өзгерді:** UUID filename, stable QR_DIRECTORY, EPSILON size fix, guarded updateMany және failed/replaced file cleanup.

**Неге өзгертілді:** concurrent generation/slug edit жаңа нәтижені басып кетпеуі және orphan файлдар қалмауы үшін.

**Жаңа flow:** PNG → жаңа file → guarded DB save → success old cleanup; conflict/error new cleanup. Ownership бұрыннан тексерілген.

### `src/services/redirectService.js`

**Бұрынғы мақсаты:** cache → restrictions → SET NX/INCR; DB password compare/temporary JWT.

**Не өзгерді:** missing verifyToken import; corrupt cache JSON fallback; EXPIRED status check; max Redis/DB count; integer exp; Lua reserve; missing counter кезінде fresh DB baseline; verify flow maxClicks check.

**Неге өзгертілді:** protected redirect жарамды token-ді тексере алуы және concurrent limit reservation артық өтпеуі үшін.

**Жаңа flow:** Link → restrictions → atomic reserve → Controller; verify → restrictions/compare/count → temporary JWT. Redis outage-қа жалпы DB-only fallback қосылған жоқ.

### `src/utils/jwt.js`

**Бұрынғы мақсаты:** account/5m redirect tokens және jwt.verify.

**Не өзгерді:** verify algorithms тек HS256.

**Неге өзгертілді:** token verification-ның қабылдайтын algorithm-ін нақтылау.

**Жаңа flow:** signature HS256 → middleware/service claims checks. Екі token generator бұрыннан болған.

### `src/utils/logger.js`

**Бұрынғы мақсаты:** бос logger placeholder; басқа жерлерде console қолданылған.

**Не өзгерді:** Winston console/file, timestamp, redaction, circular/error handling, bounded file settings және test silent.

**Неге өзгертілді:** HTTP/startup/Redis/Worker/errors logs бір форматта және secrets-сіз болуы үшін.

**Жаңа flow:** logger metadata → redact → console + error/combined files. Git M.

### `src/validators/analyticsValidator.js`

**Бұрынғы мақсаты:** UUID/days/page/limit validation.

**Не өзгерді:** query single string check; page upper bound 1000000.

**Неге өзгертілді:** repeated/array query және өте үлкен offsets қабылданбауы үшін.

**Жаңа flow:** single value → integer/range → toInt → Service.

### `src/validators/authValidator.js`

**Бұрынғы мақсаты:** name/email/password және registration minimum length.

**Не өзгерді:** strings/bail before sanitizers; барлық password input ≤72 UTF-8 bytes.

**Неге өзгертілді:** қате types және bcrypt input byte boundary-ін анықтау.

**Жаңа flow:** type → normalize/length/bytes → sanitized errors немесе auth Service.

### `src/validators/linkValidator.js`

**Бұрынғы мақсаты:** URL/slug/title/tags/expiry/maxClicks/UUID/pagination/password/QR validation.

**Не өзгерді:** URL credentials forbidden; reserved slug set; strict ISO string; maxClicks 32-bit/type; password 72-byte; scalar query/color/size checks; redirect slug/token validator.

**Неге өзгертілді:** invalid data DB/Redis/QR boundary-ге өтпеуі, reserved Route collision болмауы үшін.

**Жаңа flow:** body/query/path type+range → validate Middleware → Controller.

### `tests/analytics.test.js`

**Бұрынғы мақсаты:** бос analytics test placeholder.

**Не өзгерді:** distinct/live stats, clicks UTM/pagination, groups/overview/days және Processor retry assertions толтырылды.

**Неге өзгертілді:** analytics behavior мен duplicate protection-ды бекіту.

**Жаңа flow:** fixtures → real HTTP/service + doubles → response/DB assertions. Git M.

### `tests/auth.test.js`

**Бұрынғы мақсаты:** бос auth test placeholder.

**Не өзгерді:** registration/hash/profile/login/validation/duplicates/token/logout cases.

**Неге өзгертілді:** account access және safe output behavior тексеру.

**Жаңа flow:** fixtures/request → Middleware/Service/JWT/bcrypt → assertions. Git M.

### `tests/links.test.js`

**Бұрынғы мақсаты:** бос Link test placeholder.

**Не өзгерді:** CRUD, slug, invalid fields, pagination, ownership injection/hash/cache/delete/toggle tests.

**Неге өзгертілді:** private resources-тің құқықтары мен mutation behavior-ды бекіту.

**Жаңа flow:** owner/stranger fixtures → HTTP actions → safe results/memory state assertions. Git M.

### `tests/redirect.test.js`

**Бұрынғы мақсаты:** бос redirect test placeholder.

**Не өзгерді:** 302/cache/job, restrictions, concurrency budget/rename, password tokens, payload privacy және queue failure assertions.

**Неге өзгертілді:** ең маңызды public flow-дағы restrictions/idempotency input contract сақтау.

**Жаңа flow:** mock Redis/Queue + real redirect Service → 302/4xx/5xx + reservation/job assertions. Git M.

### `tests/setup.js`

**Бұрынғы мақсаты:** бос shared setup placeholder.

**Не өзгерді:** explicit integration URLs capture, NODE_ENV=test, dummy closed-port unit URLs, deterministic JWT/BASE_URL/client config.

**Неге өзгертілді:** unit tests development services-ті қолданбауы және missing integration URL айқын skip болуы үшін.

**Жаңа flow:** dotenv → configured opt-in URLs capture → safe test defaults → suites. Git M.

## 5. Ескі архитектура → жаңа архитектура

| Бөлік | Бұрын | Қазір |
| --- | --- | --- |
| Redirect limit | count тексеру → бөлек SET NX/INCR | бастапқы check → қажет болса fresh baseline → атомарлы Lua check+reserve |
| Analytics payload | token алынған, қалған барлық query + raw Referer | үш scalar UTM + sanitized Referer + UUID + request time |
| Analytics processing | Worker inline Click.create + increment | Worker → Processor → duplicate skip → transactional count |
| Startup | eager app/Worker imports → DB/ping → listen | checked env → DB → Redis ready → app/Queue/Worker ready → listen |
| QR | file → unconditional DB save; old file қалған | file → guarded DB save → old/new cleanup; rename/delete cleanup |
| Logging | console + Morgan dev, бос logger | safe Route template Morgan → redacting Winston; shared event logs |
| Errors | status/message/originalUrl тікелей JSON | operational/known mappings → masked JSON + safe 5xx logs |
| Tests | бос files/config | deterministic HTTP doubles + opt-in dedicated integrations |
| Docker | DB/Redis Compose, бос Dockerfile | Compose сақталған + health/loopback/noeviction; optional non-root API image |
| Environment | variable presence ғана | protocol/origin/port/secret/duration/proxy checks + dedicated test DB guards |

```text
Бұрын: Redirect → Queue → Worker ішіндегі барлық parsing/DB logic
Қазір: Redirect → sanitized payload/UUID → Queue → Worker → Processor
                                                        → Click + count transaction
```

```text
Бұрын: Ctrl+C/process exit → resources үшін ортақ close flow болмаған
Қазір: signal → readiness false → HTTP close → Worker/Queue → DB/Redis close
```

## 6. Неге бұл өзгерістер керек болды?

- **Atomic reservation:** соңғы бір бос click-ті қатар келген бірнеше сұрау бірге пайдалана алмайды.
- **Stable click ID:** retry — жаңа келуші емес; бір job бірнеше рет өңделсе count қайталанбауы керек.
- **Request timestamp:** queue кешіксе де Click уақыты Worker өңдеген сәтке ауыспайды.
- **QR cleanup/guard:** ескі суреттер дискіні толтырмауы және ескі generation жаңа slug нәтижесін баспауы керек.
- **Logger/redaction:** ақауды табуға method/status/code жеткілікті; JWT/password/connection URL жарияланбауы керек.
- **Error masking:** клиентке SQL/file path/stack сияқты ішкі ақпарат бермей, пайдалы HTTP status сақтау.
- **Test DB guards:** автоматты cleanup development деректерін нысана етпеуі керек.
- **Readiness:** HTTP app жауап беруі мен DB/Redis дайын болуы — бөлек жағдайлар.
- **Graceful shutdown:** белсенді request/job-тардың аяқталуына уақыт беріп, connections-ті жабу.
- **Swagger:** input/output/auth/error contract-ты студентке және API client-ке бір жерде көрсету.
- **Bounded dependency calls:** connection outage-та request/startup шексіз күтіп қалмауы үшін.

## 7. Қазіргі толық request flow

### Auth request

`/api` limiter → `/api/auth` limiter → parser → authRoutes validator → validate → authController → authService → bcrypt/Prisma → account JWT → safe response. Me/logout үшін Route ішінде auth Middleware бар.

### Private Link request

General API limiter → parser → linkRoutes auth (Bearer/claims) → UUID/body/query validator → validate → linkController → linkService/qrService → owner DB + тиісті cache/file mutation → JSON.

### Redirect request

Security/parser → redirectLimiter → redirectValidator → validate → redirectController → redirectService → Redis metadata немесе DB cache fill → restrictions/token → atomic reservation → sanitized analytics job → await Queue acceptance → 302 originalUrl.

### Password verification

redirectLimiter + passwordLimiter → slug/token/body validators → Controller → DB Link restrictions + bcrypt + maxClicks → бес минуттық redirect JWT. Осы request Click сақтамайды.

### Background analytics

analytics Queue/Redis → Worker (өз connection-ы, concurrency 20) → Processor → UAParser/GeoIP/sanitization → stable Click ID → createMany skipDuplicates + conditional Link increment transaction → complete/retry/failed logs.

## 8. Ең маңызды өзгертілген кодтар

Төмендегі **16 шағын үзінді нақты current source-тен** алынған. Толық контекст үшін көрсетілген файлды оқыңыз.

### 1. Test URL-ді app-та таңдау — `src/config/env.js`

```js
const databaseVariable = nodeEnv === "test" ? "TEST_DATABASE_URL" : "DATABASE_URL";
const databaseUrl = required(databaseVariable);
const database = parseUrl(databaseVariable, databaseUrl, ["postgres:", "postgresql:"]);
```

Test mode қалыпты URL-ді таңдаудан бастай алмайды; артынан DB name guards жүреді.

### 2. JWT algorithm — `src/utils/jwt.js`

```js
return jwt.verify(
  token,
  env.jwtSecret,
  { algorithms: ["HS256"] }
);
```

Verification қабылдайтын algorithm нақты берілген. Account/redirect claim checks бөлек Middleware/Service-де.

### 3. Validation error-ден құпия мәндерді алып тастау — `src/middleware/validate.js`

```js
errors: errors.array().map(({ path, location, msg }) => ({ path, location, msg })),
```

Submitted `value` response-қа кірмейді. Бұл object property үзіндісі, standalone script емес.

### 4. Rate limits — `src/middleware/rateLimiter.js`

```js
apiLimiter: createLimiter(15 * 60 * 1000, 300),
authLimiter: createLimiter(15 * 60 * 1000, 20),
redirectLimiter: createLimiter(60 * 1000, 200),
passwordLimiter: createLimiter(15 * 60 * 1000, 20),
```

Бұл exports object-інің fields-і. Бір auth request general және auth лимитіне қатар саналады.

### 5. Atomic click reservation — `src/services/redirectService.js`

```lua
local limit = tonumber(ARGV[2])
if limit >= 0 and current >= limit then return -1 end
current = current + 1
redis.call('SET', KEYS[1], current)
return current
```

Бұл JS ішіндегі RESERVE_CLICK Lua string-інің бөлігі: check пен reserve басқа request араласа алмайтын бір операция.

### 6. Counter жоғалса fresh DB baseline — `src/services/redirectService.js`

```js
const currentLink = await prisma.link.findUnique({
  where: { id: link.id, slug: link.slug },
  select: { clickCount: true },
});
if (!currentLink) throw new AppError("Link not found", 404);
baseline = currentLink.clickCount;
```

Бұл counter жоқ branch ішінде орындалады; ескі Link кэшіндегі count DB-нің жаңа мәнін баспайды.

### 7. Safe job metadata — `src/controllers/redirectController.js`

```js
userAgent: req.headers["user-agent"]?.slice(0, 2048) || null,
referer: sanitizeReferer(req.headers.referer || req.headers.referrer),
query: analyticsQuery(req.query),
}, { jobId: clickId });
```

Queue.add argument-інің соңы. Тек үш UTM field өтеді; jobId мен Click ID бір UUID болады.

### 8. Idempotent count — `src/utils/analyticsProcessor.js`

```js
if (result.count === 0) return false;
await tx.link.update({
  where: { id: linkId },
  data: { clickCount: { increment: 1 } },
});
```

`result` — `createMany(skipDuplicates: true)` нәтижесі. Duplicate Click insert болмаған жағдайда count та артпайды; екеуі бір transaction ішінде.

### 9. Safe stats total — `src/services/analyticsService.js`

```js
const totalClicks =
  Math.max(Number(redisCount) || 0, link.clickCount);
```

Төмен Redis мәні persisted DB count-ты төмендетпейді.

### 10. Concurrent QR guard — `src/services/qrService.js`

```js
const result = await prisma.link.updateMany({
  where: { id: link.id, userId, slug: link.slug, qrCodeUrl: link.qrCodeUrl },
  data: { qrCodeUrl: qrUrl },
});
```

DB snapshot өзгерсе count 0, кейін 409/cleanup. Соңғы қалыпты нәтижені ескі generation баспайды.

### 11. QR path guard — `src/utils/qrFiles.js`

```js
if (!/^qr-[a-zA-Z0-9-]+\.png$/.test(fileName)) return null;
const resolved = path.resolve(QR_DIRECTORY, fileName);
return path.dirname(resolved) === QR_DIRECTORY ? resolved : null;
```

Filename және resolved directory тексерісі foreign/traversal cleanup-ты тоқтатады; одан бұрын origin/prefix тексерілген.

### 12. Internal errors-ті mask жасау — `src/middleware/errorHandler.js`

```js
let statusCode = 500;
let message = "Internal Server Error";
```

Default safe; known operational/error mappings қана оны өзгертеді. Шикі `error.message` автоматты response болмайды.

### 13. Readiness dependency күту — `src/app.js`

```js
const checks = await Promise.allSettled([
  withTimeout(prisma.$queryRaw`SELECT 1`, 3000),
  withTimeout(redis.ping(), 3000),
]);
```

Бір dependency failure болса да екеуінің status-ы жиналады; ішкі connection errors клиентке берілмейді.

### 14. Worker connection-ы бөлек — `src/queues/analyticsWorker.js`

```js
const workerRedis = redis.duplicate({
  maxRetriesPerRequest: null,
  enableOfflineQueue: true,
  commandTimeout: undefined,
});
```

Blocking consumer API request-тің fail-fast settings-ін қолданбайды. Close wrapper осы connection-ды жабады.

### 15. Shutdown job-тарды connection-нан бұрын жабады — `server.js`

```js
const jobResults = await Promise.allSettled([worker?.close(), queue?.close()]);
const connectionResults = await Promise.allSettled([
  prisma?.$disconnect(),
  redis?.status === "ready" ? redis.quit() : redis?.disconnect(),
]);
```

Worker DB/Redis-ті қолданатын кезде connection-ды алдын ала ажыратпау үшін осы екі await кезеңі ретімен орындалады.

### 16. Test cleanup scope — `tests/postgres.integration.test.js`

```js
if (emails.length) await prisma.user.deleteMany({ where: { email: { in: emails } } });
```

`emails` — осы test жасаған random fixture email-дері. Барлық User/Link кестесін reset жасамайды; DB URL guard одан бұрын орындалады.

## 9. Нені өзгеріс деп шатастырмау керек?

- `prisma/schema.prisma`, initial migration, migration_lock және бос seed өзгермеген; Prisma 7/adapter бұрыннан бар.
- `authService`, `authController`, `linkController`, `analyticsController`, `adminController`, `authRoutes`, `linkRoutes`, `analyticsRoutes`, `admin` Middleware, AppError/bcrypt/slug/GeoIP/UA utilities өзгермеген.
- Ownership/password hash hiding, COUNT(DISTINCT ip), existing grouped analytics, five-minute redirect JWT, Queue retries/retention және Worker concurrency бұрыннан болған.
- Нақты ignored `.env` өзгерісінің тарихын Git diff дәлелдей алмайды; оның құпия мәндері оқылып/құжатқа көшірілген жоқ.
- Runtime PNG/logs — source файл additions емес. Tooling `.agents/.claude/.windsurf` және skills-lock тарихи салыстырылған commit-те өзгермеген; олар HTTP backend архитектурасына кірмейді.
- Frontend бұл backend репозиторийінен бөлек. Оның жасалуы осы `1394dfc → c245a34` backend diff-іне кірмейді.

## 10. Қазіргі іске асырудың шекаралары

Logout token-ді серверде revoked етпейді; redirect JWT one-time емес. Redis/Queue қажет: тек cache MISS DB fallback бар. Queue failure reservation-ды сақтайды, сондықтан total reservation міндетті түрде successful redirect санына тең емес. PostgreSQL mutation мен Redis/file cleanup бір distributed transaction емес. Analytics Worker-ден кейін көрінеді; unique IP адам санының дәл өлшемі емес. Limiter store per-process. `/ready` dependency response-ты тексереді, failed jobs-ты түгел дәлелдемейді.

Test doubles real services-тің барлық guarantees-ін дәлелдемейді; real integration explicit test URLs-пен ғана орындалады. Тесттер reset/truncate/flush жасамайды. Бұл құжаттау кезінде тек read-only inspection және осы екі Markdown файлды жазу орындалды; жаңа runtime pass/audit нәтижесі жарияланбайды.

Оқуға ыңғайлы рет: `app.js` → Route/Middleware → Controller/Service → Redis reservation → Queue/Worker/Processor → QR lifecycle → tests. Қорғауда «негізгі мүмкіндіктер бұрын бар еді, жалғастыру олардың қауіпсіздік, concurrency, lifecycle, docs және test жақтарын аяқтады» деп түсіндіруге болады.
