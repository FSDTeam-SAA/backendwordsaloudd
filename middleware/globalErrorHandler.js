import handleValidationError from "../errors/handleValidationError.js";
import HandleCastError from "../errors/HandleCastError.js";
import handleDuplicateError from "../errors/handleDuplicateError.js";
import AppError from "../errors/AppError.js";

const globalErrorHandler = (err, req, res, next) => {
  console.log({ GlobalError: err });
  let statusCode = 500;
  let message = err.message || "Something went wrong";
  let errorSources = [{ path: "", message: err.message }];

  if (err?.name === "ValidationError") {
    const simplifiedError = handleValidationError(err);
    statusCode = simplifiedError.statusCode;
    message = simplifiedError.message;
    errorSources = simplifiedError.errorSources;
  } else if (err?.name === "CastError") {
    const simplifiedError = HandleCastError(err);
    statusCode = simplifiedError.statusCode;
    message = simplifiedError.message;
    errorSources = simplifiedError.errorSources;
  } else if (err?.code === 11000) {
    const simplifiedError = handleDuplicateError(err);
    statusCode = simplifiedError.statusCode;
    message = simplifiedError.message;
    errorSources = simplifiedError.errorSources;
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    errorSources = [{ path: "", message: err.message }];
  } else if (err?.name === "MulterError") {
    statusCode = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    message = err.code === "LIMIT_FILE_SIZE"
      ? "Uploaded media must be 20 MB or smaller"
      : err.message;
    errorSources = [{ path: "media", message }];
  } else if (err?.message === "Only JPG, PNG, and MP4 files are allowed") {
    statusCode = 400;
    message = err.message;
    errorSources = [{ path: "media", message }];
  }

  return res.status(statusCode).json({
    success: false,
    message,
    errorSources,
    stack: process.env.NODE_ENV === "production" ? undefined : err?.stack,
  });
};

export default globalErrorHandler;
