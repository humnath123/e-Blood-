import { Request, Response, NextFunction } from "express";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error("Error handler caught:", err);

  // Default status code
  let statusCode = 500;
  let errorCode = "INTERNAL_ERROR";
  let message = "Internal server error";

  // Handle Oracle-specific errors
  if (err.code) {
    switch (err.code) {
      case "ORA-00001": // Unique constraint violation
        statusCode = 409;
        errorCode = "CONSTRAINT_VIOLATION";
        message = "Duplicate entry. The resource already exists.";
        break;
      case "ORA-02291": // Foreign key constraint violation
        statusCode = 400;
        errorCode = "FOREIGN_KEY_VIOLATION";
        message = "Referenced resource does not exist.";
        break;
      case "ORA-12514": // TNS:listener does not currently know of service requested in connect descriptor
      case "ORA-12541": // TNS:no listener
      case "ORA-01017": // Invalid username/password
        statusCode = 503;
        errorCode = "DB_CONNECTION_ERROR";
        message = "Database connection error. Please try again later.";
        break;
      case "ORA-01403": // No data found
        statusCode = 404;
        errorCode = "NOT_FOUND";
        message = "Resource not found.";
        break;
      default:
        // Oracle error - check message for more clues
        if (err.message?.includes("unique constraint")) {
          statusCode = 409;
          errorCode = "CONSTRAINT_VIOLATION";
          message = "Duplicate entry.";
        }
    }
  }

  // Handle Zod validation errors
  if (err?.name === "ZodError") {
    statusCode = 400;
    errorCode = "VALIDATION_ERROR";
    const validationDetails = (err.issues ?? err.errors ?? []).map((e: any) => ({
      path: e.path.join("."),
      message: e.message,
    }));
    message = "Validation failed";
    // Include details in response body but keep it concise
    console.error("Validation errors:", validationDetails);
  }

  // Handle Mongoose/sequelize style errors
  if (err.statusCode) {
    statusCode = err.statusCode;
  }

  if (err.code) {
    errorCode = err.code;
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message,
      ...(process.env.NODE_ENV !== "production" && { details: err.message }),
    },
    data: null,
  });
};