require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");

const authRoutes = require("./routes/authRoutes");
const linkRoutes = require("./routes/linkRoutes");
const redirectRoutes = require("./routes/redirectRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const adminRoutes = require("./routes/adminRoutes");

const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

const app = express();

app.disable("x-powered-by");

app.use(helmet());

app.use(cors());

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  }),
);

if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "URL Shortener API is running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/links", linkRoutes);
app.use("/api", analyticsRoutes);
app.use("/api/admin", adminRoutes);


app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use("/", redirectRoutes);

app.use(notFoundHandler);

app.use(errorHandler);

module.exports = app;
