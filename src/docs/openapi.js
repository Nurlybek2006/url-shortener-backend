// Public documentation only: keep environment values and credentials out of this file.
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const parameter = (name) => ({ $ref: `#/components/parameters/${name}` });
const arrayOf = (schema) => ({ type: "array", items: schema });
const object = (properties, required = Object.keys(properties)) => ({
  type: "object", properties, required,
});
const integer = { type: "integer", minimum: 0 };
const timestamp = { type: "string", format: "date-time" };
const nullableString = { type: "string", nullable: true };
const uuid = { type: "string", format: "uuid" };
const bearer = [{ bearerAuth: [] }];
const json = (schema, example) => ({
  "application/json": { schema, ...(example ? { example } : {}) },
});
const response = (description, schema, example) => ({
  description, content: json(schema, example),
});
const envelope = (properties) => object({
  success: { type: "boolean", enum: [true] },
  data: object(properties),
});
const body = (schema, example) => ({ required: true, content: json(schema, example) });
const errors = (...codes) => Object.fromEntries(
  [...new Set([...codes, 429, 500])].map((code) => [code, { $ref: `#/components/responses/Error${code}` }]),
);
const listParameters = (defaultLimit) => [
  parameter("Page"),
  { name: "limit", in: "query", description: "Records per page.", schema: { type: "integer", minimum: 1, maximum: 100, default: defaultLimit } },
];
const linkExample = {
  id: "e2d116d9-d9f9-4bfd-bcf6-456b2775b99b",
  slug: "example-link",
  originalUrl: "https://example.com/article",
  title: "Example article",
  status: "ACTIVE",
  userId: "16ef0c6a-f59d-489d-aa40-35cf4aa00925",
  expiresAt: null,
  maxClicks: null,
  clickCount: 0,
  tags: ["articles"],
  qrCodeUrl: null,
  createdAt: "2026-01-01T12:00:00.000Z",
  updatedAt: "2026-01-01T12:00:00.000Z",
  passwordProtected: false,
  shortUrl: "http://localhost:3000/example-link",
};
const userExample = {
  id: linkExample.userId, name: "Example User", email: "user@example.com",
  role: "USER", createdAt: linkExample.createdAt,
};
const paginationExample = { page: 1, limit: 10, total: 1, totalPages: 1 };
const linkResponse = (description) => response(description, envelope({ link: ref("Link") }), {
  success: true, data: { link: linkExample },
});
const linkInputProperties = {
  originalUrl: { type: "string", format: "uri", pattern: "^https?://", description: "Absolute HTTP or HTTPS destination URL." },
  title: { type: "string", nullable: true, maxLength: 200 },
  slug: { type: "string", pattern: "^[a-zA-Z0-9_-]{3,50}$", description: "Optional unique custom slug. Application-reserved paths cannot be used." },
  expiresAt: { ...timestamp, nullable: true, description: "Future expiry time; null removes expiry." },
  maxClicks: { type: "integer", nullable: true, minimum: 1, maximum: 2147483647, description: "Maximum accepted redirects; null removes the limit." },
  tags: { type: "array", maxItems: 20, items: { type: "string", minLength: 1, maxLength: 50 } },
  password: { type: "string", nullable: true, minLength: 4, maxLength: 72, writeOnly: true, description: "Optional link password; null removes protection. Maximum 72 UTF-8 bytes." },
};
const safeLinkProperties = {
  id: uuid,
  slug: { type: "string" },
  originalUrl: { type: "string", format: "uri" },
  title: nullableString,
  status: { type: "string", enum: ["ACTIVE", "EXPIRED", "DISABLED", "PASSWORD_PROTECTED"] },
  expiresAt: { ...timestamp, nullable: true },
  maxClicks: { type: "integer", nullable: true },
  clickCount: integer,
  tags: arrayOf({ type: "string" }),
  qrCodeUrl: { type: "string", format: "uri", nullable: true },
  createdAt: timestamp,
  updatedAt: timestamp,
};
const group = arrayOf(object({ name: { type: "string" }, count: integer }));
const schemas = {
  Error: {
    type: "object", required: ["success", "error"],
    properties: {
      success: { type: "boolean", enum: [false] },
      error: { type: "string" },
      errors: arrayOf(object({
        type: { type: "string" }, location: { type: "string" },
        path: { type: "string" }, msg: { type: "string" },
      }, ["msg"])),
    },
    example: { success: false, error: "Link not found" },
  },
  Message: object({ success: { type: "boolean", enum: [true] }, message: { type: "string" } }),
  User: object({
    id: uuid, name: { type: "string" }, email: { type: "string", format: "email" },
    role: { type: "string", enum: ["USER", "ADMIN"] }, createdAt: timestamp,
  }),
  RegisterInput: object({
    name: { type: "string", minLength: 2, maxLength: 50 },
    email: { type: "string", format: "email", maxLength: 254 },
    password: { type: "string", minLength: 6, maxLength: 72, writeOnly: true, description: "Maximum 72 UTF-8 bytes; stored only as a bcrypt hash." },
  }),
  LoginInput: object({
    email: { type: "string", format: "email" }, password: { type: "string", minLength: 1, maxLength: 72, writeOnly: true, description: "Maximum 72 UTF-8 bytes." },
  }),
  AuthResult: envelope({ user: ref("User"), token: { type: "string", description: "Account JWT used with Authorization: Bearer <token>." } }),
  Link: { ...object({
    ...safeLinkProperties, userId: uuid, passwordProtected: { type: "boolean" },
    shortUrl: { type: "string", format: "uri" },
  }), example: linkExample },
  AdminLink: object({
    ...safeLinkProperties,
    user: object({ id: uuid, name: { type: "string" }, email: { type: "string", format: "email" }, role: { type: "string", enum: ["USER", "ADMIN"] } }),
  }),
  CreateLinkInput: object(linkInputProperties, ["originalUrl"]),
  UpdateLinkInput: { ...object(linkInputProperties, []), description: "Only supplied fields change. Use null to clear title, password, expiry, or maxClicks." },
  Pagination: { ...object({ page: { type: "integer", minimum: 1 }, limit: { type: "integer", minimum: 1, maximum: 100 }, total: integer, totalPages: integer }), example: paginationExample },
  QrInput: object({
    size: { type: "integer", minimum: 128, maximum: 2048, default: 512 },
    darkColor: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$", default: "#000000" },
    lightColor: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$", default: "#FFFFFF" },
  }, []),
  Click: object({
    id: uuid, clickedAt: timestamp, ip: { type: "string" },
    browser: nullableString, os: nullableString, device: nullableString,
    country: nullableString, city: nullableString, referer: nullableString,
    utmSource: nullableString, utmMedium: nullableString, utmCampaign: nullableString,
  }),
  Stats: object({
    linkId: uuid, slug: { type: "string" }, totalClicks: integer, uniqueVisitors: integer,
    lastClickedAt: { ...timestamp, nullable: true }, createdAt: timestamp,
  }),
  Period: object({ days: { type: "integer", minimum: 1, maximum: 365 }, since: timestamp, until: timestamp }),
  Analytics: object({
    totalClicks: integer, uniqueVisitors: integer,
    byBrowser: group, byOS: group, byDevice: group, byCountry: group,
    byDay: arrayOf(object({ date: timestamp, count: integer })),
    byHour: arrayOf(object({ hour: { type: "integer", minimum: 0, maximum: 23 }, count: integer })),
    period: ref("Period"),
  }),
  Overview: object({
    totalLinks: integer, activeLinks: integer, totalClicks: integer,
    topLinks: arrayOf(object({ id: uuid, slug: { type: "string" }, title: nullableString, originalUrl: { type: "string", format: "uri" }, clickCount: integer, createdAt: timestamp })),
    period: ref("Period"),
  }),
  Readiness: object({
    success: { type: "boolean" },
    services: object({ database: { type: "string", enum: ["ok", "unavailable"] }, redis: { type: "string", enum: ["ok", "unavailable"] } }),
  }),
};
const commonResponses = Object.fromEntries(Object.entries({
  400: ["Invalid request body, route parameter, or query parameter", "Validation failed"],
  401: ["Missing, invalid, or expired token; or incorrect credentials", "Authentication required"],
  403: ["Insufficient role", "Admin access required"],
  404: ["Resource does not exist or is not owned by the current user", "Link not found"],
  409: ["Email/custom slug already exists, or concurrent QR/link change", "Slug already exists"],
  410: ["Link disabled, expired, or click limit reached", "Link has expired"],
  413: ["Request body exceeds 100 KB", "Request body is too large"],
  429: ["IP rate limit exceeded; retry after the response header interval", "Too many requests, please try again later"],
  500: ["Unexpected server error; internal details are not returned in production", "Internal Server Error"],
  503: ["Required dependency is unavailable", "Service unavailable"],
}).map(([code, [description, message]]) => [`Error${code}`, {
  ...response(description, ref("Error"), { success: false, error: message }),
  ...(code === "429" ? { headers: { "Retry-After": { description: "Seconds before retrying.", schema: { type: "integer" } } } } : {}),
}]));

module.exports = {
  openapi: "3.0.3",
  info: {
    title: "URL Shortener + Analytics Backend",
    version: "1.0.0",
    description: "JWT-authenticated link management with public redirects and asynchronous click analytics. Account tokens and short-lived redirect tokens have separate purposes. Private link endpoints only access the current user's links, including for administrators. All timestamps use ISO 8601. Password hashes are never returned. API responses may include an additional message field. Limits per IP: API 300/15 minutes, authentication 20/15 minutes, public redirects 200/minute, password verification 20/15 minutes. Authentication requests also count toward the API limit. Rate limit counters are per process.",
  },
  servers: [{ url: "/", description: "This API instance" }],
  tags: [
    { name: "Auth", description: "Registration, account JWTs, and profile" },
    { name: "Links", description: "Owner-only link and QR management" },
    { name: "Analytics", description: "Owner-only analytics; worker processing is asynchronous" },
    { name: "Admin", description: "Administrator access across users" },
    { name: "Redirect", description: "Public short links and password verification" },
    { name: "Infrastructure", description: "Liveness, dependency readiness, and QR files" },
  ],
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "Account JWT from register or login. Do not use a redirect JWT here." } },
    schemas,
    responses: commonResponses,
    parameters: {
      LinkId: { name: "id", in: "path", required: true, description: "Owned link UUID.", schema: uuid },
      Slug: { name: "slug", in: "path", required: true, description: "Case-sensitive short link slug.", schema: { type: "string", pattern: "^[a-zA-Z0-9_-]{3,50}$" }, example: "example-link" },
      Page: { name: "page", in: "query", schema: { type: "integer", minimum: 1, maximum: 1000000, default: 1 } },
      Days: { name: "days", in: "query", description: "Rolling analytics period in days.", schema: { type: "integer", minimum: 1, maximum: 365, default: 30 } },
    },
  },
  paths: {
    "/api/auth/register": { post: {
      tags: ["Auth"], operationId: "register", summary: "Register an account", security: [],
      requestBody: body(ref("RegisterInput"), { name: "Example User", email: "user@example.com", password: "example-password-only" }),
      responses: { 201: response("Account created", ref("AuthResult"), { success: true, message: "User registered successfully", data: { user: userExample, token: "<account-jwt>" } }), ...errors(400, 409, 413) },
    } },
    "/api/auth/login": { post: {
      tags: ["Auth"], operationId: "login", summary: "Sign in and issue an account token", security: [],
      requestBody: body(ref("LoginInput"), { email: "user@example.com", password: "example-password-only" }),
      responses: { 200: response("Signed in", ref("AuthResult"), { success: true, data: { user: userExample, token: "<account-jwt>" } }), ...errors(400, 401, 413) },
    } },
    "/api/auth/me": { get: {
      tags: ["Auth"], operationId: "getProfile", summary: "Get the current user's profile", security: bearer,
      responses: { 200: response("Profile", envelope({ user: ref("User") }), { success: true, data: { user: userExample } }), ...errors(401, 404) },
    } },
    "/api/auth/logout": { post: {
      tags: ["Auth"], operationId: "logout", summary: "Acknowledge logout", security: bearer,
      description: "Delete the token on the client after this response. Stateless JWTs are not revoked by this endpoint and remain valid until expiry.",
      responses: { 200: response("Logged out", ref("Message"), { success: true, message: "Logout successful" }), ...errors(401) },
    } },
    "/api/links": {
      post: {
        tags: ["Links"], operationId: "createLink", summary: "Create a short link", security: bearer,
        description: "A unique random slug is generated if slug is omitted. Optional restrictions can be combined.",
        requestBody: body(ref("CreateLinkInput"), { originalUrl: "https://example.com/article", title: "Example article", slug: "example-link", expiresAt: null, maxClicks: null, tags: ["articles"], password: null }),
        responses: { 201: linkResponse("Link created"), ...errors(400, 401, 409, 413) },
      },
      get: {
        tags: ["Links"], operationId: "listLinks", summary: "List the current user's links", security: bearer, parameters: listParameters(10),
        responses: { 200: response("Links, newest first", envelope({ links: arrayOf(ref("Link")), pagination: ref("Pagination") }), { success: true, data: { links: [linkExample], pagination: paginationExample } }), ...errors(400, 401) },
      },
    },
    "/api/links/{id}": {
      parameters: [parameter("LinkId")],
      get: {
        tags: ["Links"], operationId: "getLink", summary: "Get one owned link", security: bearer,
        responses: { 200: linkResponse("Link details"), ...errors(400, 401, 404) },
      },
      patch: {
        tags: ["Links"], operationId: "updateLink", summary: "Update an owned link", security: bearer,
        requestBody: body(ref("UpdateLinkInput"), { title: "Updated title", maxClicks: 100, password: null }),
        responses: { 200: linkResponse("Updated link"), ...errors(400, 401, 404, 409, 413) },
      },
      delete: {
        tags: ["Links"], operationId: "deleteLink", summary: "Delete an owned link and associated analytics", security: bearer,
        responses: { 200: response("Link deleted", ref("Message"), { success: true, message: "Link deleted successfully" }), ...errors(400, 401, 404) },
      },
    },
    "/api/links/{id}/toggle": { post: {
      tags: ["Links"], operationId: "toggleLink", summary: "Toggle ACTIVE / DISABLED", security: bearer, parameters: [parameter("LinkId")],
      description: "A disabled link becomes active; all other states become disabled. Password, expiry, and click restrictions still apply when enabled.",
      responses: { 200: linkResponse("Link state changed"), ...errors(400, 401, 404) },
    } },
    "/api/links/{id}/qr": { post: {
      tags: ["Links"], operationId: "generateQr", summary: "Generate a PNG QR code for an owned link", security: bearer, parameters: [parameter("LinkId")],
      requestBody: { ...body(ref("QrInput"), { size: 512, darkColor: "#000000", lightColor: "#FFFFFF" }), required: false },
      description: "Replaces the previous generated QR file. Concurrent generation or link modification may return 409; retry using the latest link. Changing the link slug clears its QR URL and requires regeneration.",
      responses: { 201: response("QR generated and URL saved on the link", envelope({ qrUrl: { type: "string", format: "uri" }, shortUrl: { type: "string", format: "uri" }, fileName: { type: "string" } }), { success: true, data: { qrUrl: "http://localhost:3000/uploads/qr/qr-example.png", shortUrl: linkExample.shortUrl, fileName: "qr-example.png" } }), ...errors(400, 401, 404, 409, 413) },
    } },
    "/api/links/{id}/stats": { get: {
      tags: ["Analytics"], operationId: "getLinkStats", summary: "Get lifetime click counts for an owned link", security: bearer, parameters: [parameter("LinkId")],
      description: "totalClicks uses the current Redis counter when available. Unique visitors count distinct stored IPs, so this value and lastClickedAt may lag redirects until the worker finishes.",
      responses: { 200: response("Lifetime stats", envelope({ stats: ref("Stats") }), { success: true, data: { stats: { linkId: linkExample.id, slug: linkExample.slug, totalClicks: 5, uniqueVisitors: 3, lastClickedAt: "2026-01-02T12:00:00.000Z", createdAt: linkExample.createdAt } } }), ...errors(400, 401, 404) },
    } },
    "/api/links/{id}/clicks": { get: {
      tags: ["Analytics"], operationId: "getLinkClicks", summary: "Get stored clicks for an owned link", security: bearer, parameters: [parameter("LinkId"), ...listParameters(20)],
      responses: { 200: response("Clicks, newest first", envelope({ clicks: arrayOf(ref("Click")), pagination: ref("Pagination") }), { success: true, data: { clicks: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } } }), ...errors(400, 401, 404) },
    } },
    "/api/links/{id}/analytics": { get: {
      tags: ["Analytics"], operationId: "getLinkAnalytics", summary: "Get aggregated analytics for an owned link", security: bearer, parameters: [parameter("LinkId"), parameter("Days")],
      description: "Browser, OS, device, and country groups include the ten largest groups. Only dates/hours with clicks are included. IP-based unique visitors are approximate.",
      responses: { 200: response("Analytics over the requested rolling period", envelope({ analytics: ref("Analytics") }), { success: true, data: { analytics: { totalClicks: 1, uniqueVisitors: 1, byBrowser: [{ name: "Chrome", count: 1 }], byOS: [{ name: "Windows", count: 1 }], byDevice: [{ name: "desktop", count: 1 }], byCountry: [{ name: "Unknown", count: 1 }], byDay: [{ date: "2026-01-02T00:00:00.000Z", count: 1 }], byHour: [{ hour: 12, count: 1 }], period: { days: 30, since: "2026-01-01T00:00:00.000Z", until: "2026-01-31T00:00:00.000Z" } } } }), ...errors(400, 401, 404) },
    } },
    "/api/analytics/overview": { get: {
      tags: ["Analytics"], operationId: "getOverview", summary: "Get analytics across the current user's links", security: bearer, parameters: [parameter("Days")],
      description: "totalClicks covers the requested period. totalLinks and activeLinks are current totals. topLinks lists up to five links ranked by lifetime stored clickCount.",
      responses: { 200: response("User overview", envelope({ overview: ref("Overview") }), { success: true, data: { overview: { totalLinks: 1, activeLinks: 1, totalClicks: 0, topLinks: [{ id: linkExample.id, slug: linkExample.slug, title: linkExample.title, originalUrl: linkExample.originalUrl, clickCount: 0, createdAt: linkExample.createdAt }], period: { days: 30, since: "2026-01-01T00:00:00.000Z", until: "2026-01-31T00:00:00.000Z" } } } }), ...errors(400, 401) },
    } },
    "/api/admin/links": { get: {
      tags: ["Admin"], operationId: "adminListLinks", summary: "List all users' links (ADMIN only)", security: bearer, parameters: listParameters(20),
      responses: { 200: response("Links with safe owner information", envelope({ links: arrayOf(ref("AdminLink")), pagination: ref("Pagination") }), { success: true, data: { links: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } } }), ...errors(400, 401, 403) },
    } },
    "/{slug}": { get: {
      tags: ["Redirect"], operationId: "redirect", summary: "Redirect to the original URL", security: [],
      description: "Returns a 302 Location header after checking restrictions and enqueuing analytics. The worker runs asynchronously. Send a short-lived redirect token for password-protected links. The token is excluded from analytics. UTM parameters are captured for analytics; the original destination URL is preserved.",
      parameters: [parameter("Slug"),
        { name: "token", in: "query", description: "Five-minute redirect JWT obtained from /{slug}/verify. This is not an account JWT.", schema: { type: "string", maxLength: 2048 } },
        ...["utm_source", "utm_medium", "utm_campaign"].map((name) => ({ name, in: "query", description: "Optional scalar campaign analytics value, stored up to 500 characters.", schema: { type: "string" } })),
      ],
      responses: {
        302: { description: "Redirect accepted", headers: { Location: { description: "Original destination URL.", schema: { type: "string", format: "uri", example: "https://example.com/article" } } } },
        ...errors(400, 401, 404, 410, 503),
      },
    } },
    "/{slug}/verify": { post: {
      tags: ["Redirect"], operationId: "verifyLinkPassword", summary: "Verify a protected link's password", security: [], parameters: [parameter("Slug")],
      description: "Does not record a click. Use the returned token on GET /{slug}?token=... to follow the protected short link. redirectUrl is the original destination.",
      requestBody: body(object({ password: { type: "string", minLength: 1, maxLength: 72, writeOnly: true, description: "Maximum 72 UTF-8 bytes." } }), { password: "example-link-password" }),
      responses: { 200: response("Password verified", envelope({ redirectUrl: { type: "string", format: "uri" }, token: { type: "string", description: "Temporary redirect JWT, expires in five minutes." } }), { success: true, data: { redirectUrl: "https://example.com/article", token: "<redirect-jwt>" } }), ...errors(400, 401, 404, 410, 413) },
    } },
    "/health": { get: {
      tags: ["Infrastructure"], operationId: "getHealth", summary: "Check HTTP process liveness", security: [],
      responses: { 200: response("HTTP process is running; this does not check dependencies", ref("Message"), { success: true, message: "URL Shortener API is running" }) },
    } },
    "/ready": { get: {
      tags: ["Infrastructure"], operationId: "getReadiness", summary: "Check PostgreSQL and Redis readiness", security: [],
      responses: {
        200: response("Both dependencies respond", ref("Readiness"), { success: true, services: { database: "ok", redis: "ok" } }),
        503: response("At least one dependency is unavailable, or the process is shutting down", ref("Readiness"), { success: false, services: { database: "unavailable", redis: "ok" } }),
      },
    } },
    "/uploads/qr/{filename}": { get: {
      tags: ["Infrastructure"], operationId: "getQrFile", summary: "Retrieve a generated public QR PNG", security: [],
      parameters: [{ name: "filename", in: "path", required: true, schema: { type: "string" }, description: "fileName returned from QR generation." }],
      responses: { 200: { description: "PNG image", content: { "image/png": { schema: { type: "string", format: "binary" } } } }, ...errors(404) },
    } },
  },
};
