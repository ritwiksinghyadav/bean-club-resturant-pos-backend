import express from "express";
import cors from "cors";
import router from "./routes/index.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { NotFoundError } from "./utils/errors.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Mount API routes
app.use("/api/v1", router);

// Catch 404 Route Not Found
app.use((req, res, next) => {
  next(new NotFoundError(`Resource ${req.method} ${req.originalUrl} not found`));
});

// Global Error Handler
app.use(errorHandler);

export default app;
