const request = require("supertest");
const fs = require("fs").promises;
const { app, db, user, link, authorization, reset } = require("./helpers");
const { getQRFilePath, removeQRFile } = require("../src/utils/qrFiles");

const generated = new Set();
beforeEach(reset);
afterEach(async () => {
  // Only remove exact URLs returned by this suite; never enumerate uploads.
  await Promise.all([...generated].map((url) => removeQRFile(url)));
  generated.clear();
});

test("generates a PNG, serves it, replaces the old file, and removes it on deletion", async () => {
  const owner = await user();
  const target = await link(owner);
  const generate = async () => {
    const response = await request(app).post(`/api/links/${target.id}/qr`).set("Authorization", authorization(owner))
      .send({ size: 256, darkColor: "#123456", lightColor: "#FFFFFF" }).expect(201);
    generated.add(response.body.data.qrUrl);
    return response.body.data;
  };
  const first = await generate();
  expect(first.fileName).toMatch(/^qr-[a-zA-Z0-9-]+\.png$/);
  expect(db.rows.link[0].qrCodeUrl).toBe(first.qrUrl);
  const png = await fs.readFile(getQRFilePath(first.qrUrl));
  expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(png.readUInt32BE(16)).toBe(256);
  expect(png.readUInt32BE(20)).toBe(png.readUInt32BE(16));
  await request(app).get(new URL(first.qrUrl).pathname).expect(200).expect("Content-Type", /image\/png/);
  const second = await generate();
  expect(second.qrUrl).not.toBe(first.qrUrl);
  await expect(fs.access(getQRFilePath(first.qrUrl))).rejects.toMatchObject({ code: "ENOENT" });
  await request(app).delete(`/api/links/${target.id}`).set("Authorization", authorization(owner)).expect(200);
  await expect(fs.access(getQRFilePath(second.qrUrl))).rejects.toMatchObject({ code: "ENOENT" });
});

test.each([
  { size: 12 }, { size: 2049 }, { size: "invalid" },
  { darkColor: "red" }, { lightColor: "../../file" },
  { size: [] }, { size: [256] }, { darkColor: ["#000000"] },
])("validates QR options %j", async (options) => {
  const owner = await user();
  const target = await link(owner);
  await request(app).post(`/api/links/${target.id}/qr`).set("Authorization", authorization(owner)).send(options).expect(400);
  expect(db.link.updateMany).not.toHaveBeenCalled();
});

test.each([
  "http://localhost:3000/uploads/qr/../../.env",
  "http://localhost:3000/uploads/qr/%2e%2e%2f.env",
  "http://localhost:3000/uploads/qr/qr-..%5c..%5c.env.png",
  "https://attacker.example/uploads/qr/qr-safe.png",
  "file:///C:/ENT/url-shortener/backend/.env",
  "http://localhost:3000/uploads/qr/other.png",
])("QR cleanup rejects unsafe or foreign URLs: %s", async (url) => {
  expect(getQRFilePath(url)).toBeNull();
  expect(await removeQRFile(url)).toBe(false);
});
