import jwt from "jsonwebtoken";
import httpStatus from "http-status";
import AppError from "../errors/AppError.js";
import User from "../model/user.model.js";
import catchAsync from "../utils/catchAsync.js";

export const protect = catchAsync(async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Token not found");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  } catch (error) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid or expired token");
  }

  const user = await User.findById(decoded._id);
  if (!user) {
    throw new AppError(httpStatus.UNAUTHORIZED, "User not found");
  }

  if (user.isBlocked) {
    throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
  }

  req.user = user;
  next();
});

export const requireVerified = catchAsync(async (req, res, next) => {
  if (!req.user.isEmailVerified) {
    throw new AppError(httpStatus.FORBIDDEN, "Please verify your email first");
  }
  next();
});

export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You do not have permission to perform this action"
      );
    }
    next();
  };
};
