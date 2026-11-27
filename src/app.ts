// @ts-nocheck
import express, { Application, Request, Response } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import * as swaggerUi from "swagger-ui-express";
import * as fs from "fs";
import * as path from "path";
import { initDb, getPool, withConnection, withTransaction, runQuery, runQueryOne } from "./database/pool";
import { toCamelCase } from "./database/mapper";
import authRoutes from "./routes/auth";
import profileRoutes from "./routes/profile";
import searchRoutes from "./routes/search";
import requestRoutes from "./routes/requests";
import inventoryRoutes from "./routes/inventory";
import orderRoutes from "./routes/orders";
import donationRoutes from "./routes/donations";
import rewardRoutes from "./routes/rewards";
import campaignRoutes from "./routes/campaigns";
import adminRoutes from "./routes/admin";
import donorRoutes from "./routes/donors";
import bloodBankRoutes from "./routes/blood-banks";
import notificationRoutes from "./routes/notifications";
import transportRoutes from "./routes/transports";
import eventRoutes from "./routes/events";
import { errorHandler } from "./middleware/error";
import { authenticate } from "./middleware/auth";
import { setFacilityId } from "./middleware/facility";
import { swaggerDocument } from "./swagger";

const app: Application = express();
let server: any;
const port: number = 3000;
const corsOrigins: string = "*";

// Trust first proxy for IP detection
app.set("trust proxy", 1);

// Helmet security headers
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      frameSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      upgradeInsecureRequests: [],
    },
  })
);

// CORS configuration
app.use(
  cors({
    origin: corsOrigins === "*" ? true : corsOrigins.split(","),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true,
  })
);

// Rate limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/v1/auth", authLimiter);

// Request logging middleware - logs method, path, and status code
app.use((req: Request, res: Response, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Body parsing
app.use(express.json({ limit: "10kb" }));

// Swagger UI setup
const swaggerDoc = swaggerDocument;

const swaggerPath = path.join(__dirname, "..", "docs");
if (!fs.existsSync(swaggerPath)) {
  fs.mkdirSync(swaggerPath, { recursive: true });
}
fs.writeFileSync(path.join(swaggerPath, "swagger.json"), JSON.stringify(swaggerDoc, null, 2));
app.get("/docs/swagger.json", (_req: Request, res: Response) => {
  res.sendFile(path.join(swaggerPath, "swagger.json"));
});
app.get("/api/v1/openapi.json", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(swaggerDoc));
});
app.use("/docs", express.static(swaggerPath));
app.use("/docs", swaggerUi.serve);
app.get("/docs", swaggerUi.setup(swaggerDoc, {
  customSiteTitle: "eBlood API Documentation",
  swaggerOptions: {
    url: "/api/v1/openapi.json",
    deepLinking: true,
  },
}));

// Health check - database connectivity
app.get('/health', async (req: Request, res: Response) => {
  try {
    const pool = await getPool();
    const connection = await pool.getConnection();
    try {
      const result = await connection.execute("SELECT 1 AS test FROM dual");
      const isConnected = result.rows.length > 0;
      res.json({
        status: isConnected ? "ok" : "disconnected",
        database: isConnected ? "connected" : "disconnected",
      });
    } finally {
      await connection.close();
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ status: 'database unavailable' });
  }
});

// API v1 prefix router
app.use("/api/v1", async (req: Request, res: Response, next) => {
  next();
});

// Auth routes
app.use("/api/v1/auth", authRoutes);

// Profile routes
app.use("/api/v1/me", authenticate, profileRoutes);

// Search routes
app.use("/api/v1/search", searchRoutes);

// Request routes
app.use("/api/v1/requests", authenticate, requestRoutes);

// Inventory routes (staff only, own facility)
app.use("/api/v1/inventory", authenticate, setFacilityId, inventoryRoutes);

// Order routes
app.use("/api/v1/orders", authenticate, setFacilityId, orderRoutes);

// Donation routes
app.use("/api/v1/donations", authenticate, setFacilityId, donationRoutes);

// Reward routes
app.use("/api/v1/rewards", authenticate, rewardRoutes);

// Campaign routes
app.use("/api/v1/campaigns", authenticate, campaignRoutes);

// Blood transportation requests and delivery workflow
app.use("/api/v1/transports", authenticate, setFacilityId, transportRoutes);

// Donation events are separate from NGO campaigns
app.use("/api/v1/events", authenticate, eventRoutes);

// Admin routes
app.use("/api/v1/admin", authenticate, adminRoutes);
app.use("/api/v1/donors", authenticate, donorRoutes);
app.use("/api/v1/blood-banks", authenticate, bloodBankRoutes);
app.use("/api/v1/notifications", authenticate, notificationRoutes);

// Root health check (also accessible at /api/v1/health via the prefix router)
app.get("/", (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: "eBlood API is running",
  });
});

// API v1 health check
app.get("/api/v1/health", async (req: Request, res: Response) => {
  try {
    const pool = await getPool();
    const connection = await pool.getConnection();
    try {
      const result = await connection.execute("SELECT 1 AS test FROM dual");
      const isConnected = result.rows.length > 0;
      res.json({
        success: true,
        status: isConnected ? "healthy" : "disconnected",
        database: isConnected ? "connected" : "disconnected",
      });
    } finally {
      await connection.close();
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).json({
      success: false,
      status: "database unavailable",
      error: { code: "DB_UNAVAILABLE", message: "Database unavailable" },
    });
  }
});

// 404 for api v1 (terminal catch-all: any /api/v1 path not matched above)
app.use("/api/v1", (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: "Endpoint not found",
    },
    data: null,
  });
});

// Global error handler
app.use(errorHandler);

// Start server after database is ready
async function startServer() {
  try {
    // Initialize database connection
    await initDb();
    console.log("Database initialized successfully");

    server = app.listen(port, '0.0.0.0', () => {
      console.log(`eBlood server running on port ${port}`);
      console.log(`Local URL: http://localhost:${port}/api/v1/health`);
      console.log(`LAN URL: http://0.0.0.0:${port}/api/v1/health`);
      console.log(`Swagger UI: http://localhost:${port}/docs`);
    });

    // NOTE: we do NOT install an unhandledRejection handler that calls process.exit.
    // Any transient rejection from a failed route would otherwise kill the whole
    // server. Individual routes already catch their own errors.

    process.on("SIGTERM", async () => {
      console.log("SIGTERM received. Shutting down gracefully...");
      try {
        const p = await getPool();
        await p.close();
      } catch (e) {
        // ignore
      }
      server?.close(() => {
        process.exit(0);
      });
    });
  } catch (err) {
    console.error('Database startup failed:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

export { app };