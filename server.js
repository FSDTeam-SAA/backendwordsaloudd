import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import router from "./mainroute/index.js";
import globalErrorHandler from "./middleware/globalErrorHandler.js";
import notFound from "./middleware/notFound.js";
import { rateLimit } from "./middleware/rateLimit.middleware.js";
import AppError from "./errors/AppError.js";

const app = express();
let mongoConnectionPromise = null;

const connectDatabase = async () => {
  if (mongoose.connection.readyState === 1) return;

  const mongoUrl = process.env.MONGO_DB_URL;
  if (!mongoUrl) throw new Error("MONGO_DB_URL is not configured");

  if (!mongoConnectionPromise) {
    mongoConnectionPromise = mongoose.connect(mongoUrl);
  }

  try {
    await mongoConnectionPromise;
  } finally {
    mongoConnectionPromise = null;
  }
};

app.set("trust proxy", true);

const normalizeOrigin = (origin) => {
  try {
    return new URL(origin).origin;
  } catch {
    return "";
  }
};

const configuredOrigins = [
  process.env.CORS_ORIGINS,
  process.env.ADMIN_DASHBOARD_URL,
]
  .filter(Boolean)
  .join(",");
const defaultAdminOrigin = process.env.NODE_ENV === "production"
  ? "https://admin-dashboard-wordsaloud-sigma.vercel.app"
  : "http://localhost:3000";
const allowedOrigins = String(
  configuredOrigins || defaultAdminOrigin,
)
  .split(",")
  .map((origin) => normalizeOrigin(origin.trim()))
  .filter(Boolean);

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(normalizeOrigin(origin))) return callback(null, true);
      callback(new AppError(403, `Origin ${origin} is not allowed by CORS`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    optionsSuccessStatus: 204,
  })
);

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/api/v1", async (req, res, next) => {
  try {
    await connectDatabase();
    next();
  } catch (error) {
    next(error);
  }
});
app.use("/api/v1/auth", rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }));

app.use("/public", express.static("public"));

// Mount the main router
app.use("/api/v1", router);

app.get("/", (req, res) => {
  res.send("Aturservicett API is running...!!");
});

app.use(notFound);
app.use(globalErrorHandler);

const PORT = process.env.PORT || 5000;

if (!process.env.VERCEL) {
  connectDatabase()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
      });
      console.log("MongoDB connected");
    })
    .catch((err) => {
      console.error("MongoDB connection error:", err);
      process.exitCode = 1;
    });
}

export default app;
