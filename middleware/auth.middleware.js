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

  const user = await User.findById(decoded._id).select("+tokenVersion");
  if (!user) {
    throw new AppError(httpStatus.UNAUTHORIZED, "User not found");
  }

  if (user.isBlocked) {
    throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
  }
  if (decoded.tokenVersion !== undefined && Number(decoded.tokenVersion) !== Number(user.tokenVersion || 0)) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Session is no longer valid");
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
    const userRole = req.user?.role;
    const hasAccess =
      roles.includes(userRole) ||
      (userRole === "super-admin" && roles.includes("admin"));

    if (!hasAccess) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You do not have permission to perform this action"
      );
    }
    next();
  };
};

export const requireAdminPermission = (permission) => {
  return (req, res, next) => {
    if (req.user?.role === "super-admin") return next();

    if (
      req.user?.role !== "admin"  ||
      !req.user.adminPermissions?.includes(permission)
    ) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You do not have permission to access this admin section"
      );
    }

    next();
  };
};
