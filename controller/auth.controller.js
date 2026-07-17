import httpStatus from "http-status";
import User from "../model/user.model.js";
import AppError from "../errors/AppError.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import { createToken, verifyToken } from "../utils/authToken.js";
import { generateOTP } from "../utils/commonMethod.js";
import { sendEmail } from "../utils/sendEmail.js";


// export const register = catchAsync(async (req, res) => {
//   const {
//     firstName,
//     lastName,
//     email,
//     otp,
//     password,
//     confirmPassword,
//     phoneNumber,
//     role,
//     area,
//   } = req.body;

//   if (
//     !firstName ||
//     !lastName ||
//     !email ||
//     !otp ||
//     !password ||
//     !confirmPassword
//   ) {
//     throw new AppError(httpStatus.BAD_REQUEST, "All fields are required");
//   }

//   if (password !== confirmPassword) {
//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       "Passwords do not match"
//     );
//   }

//   const user = await User.findOne({
//     email: email.toLowerCase().trim(),
//   }).select("+otp.code +otp.expiresAt +password");

//   if (!user) {
//     throw new AppError(httpStatus.NOT_FOUND, "User not found");

    
//   }

//   // OTP verify
//   if (!user.isOTPValid(otp)) {
//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       "Invalid or expired OTP"
//     );
//   }

//   if (user.isProfileComplete) {
//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       "Account already exists"
//     );
//   }

//   user.firstName = firstName.trim();
//   user.lastName = lastName.trim();
//   user.password = password;
//   user.phoneNumber = phoneNumber || "";
//   user.area = area?.trim() || "";
//   user.role = ["client", "tradesman"].includes(role)
//     ? role
//     : "client";

//   user.isEmailVerified = true;
//   user.isProfileComplete = true;

//   user.clearOTP();

//   await user.save();

//   sendResponse(res, {
//     statusCode: httpStatus.CREATED,
//     success: true,
//     message: "Registration completed successfully",
//     data: {
//       _id: user._id,
//       name: user.name,
//       email: user.email,
//       role: user.role,
//       area: user.area,
//     },
//   });
// });



export const register = catchAsync(async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    otp,
    phoneNumber,
    role,
    area,
  } = req.body;

  if (!firstName || !lastName || !email || !otp) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "First name, last name, email and OTP are required"
    );
  }

  const user = await User.findOne({
    email: email.toLowerCase().trim(),
  }).select("+otp.code +otp.expiresAt");

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // OTP verify
  if (!user.isOTPValid(otp)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Invalid or expired OTP"
    );
  }

  if (user.isProfileComplete) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Account already exists"
    );
  }

  user.firstName = firstName.trim();
  user.lastName = lastName.trim();
  user.phoneNumber = phoneNumber?.trim() || "";
  user.area = area?.trim() || "";
  user.role = ["client", "tradesman"].includes(role)
    ? role
    : "client";

  user.isEmailVerified = true;
  user.isProfileComplete = true;

  user.clearOTP();

  await user.save();

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Registration completed successfully",
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      area: user.area,
    },
  });
});

// ── Sign up Step 1 — "Your Email" box on the Sign up screen ──────────────
export const sendSignupOtp = catchAsync(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new AppError(httpStatus.BAD_REQUEST, "Email is required");
  }

  const normalizedEmail = email.toLowerCase().trim();
  let user = await User.findOne({ email: normalizedEmail });

  if (user && user.isProfileComplete) {
    throw new AppError(httpStatus.BAD_REQUEST, "Email already registered. Please log in instead.");
  }

  if (!user) {
    // partial user — only email exists, everything else filled in at Step 3
    user = new User({ email: normalizedEmail, role: "client" });
  }

  const otp = generateOTP(6); // ✅ এখন 6-digit OTP
  user.setOTP(otp);
  user.isOTPVerified = false; // reset in case they're retrying
  await user.save({ validateBeforeSave: false });

  await sendEmail(user.email, "Verify your email", `Your OTP is ${otp}`);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "OTP sent to your email",
    data: { email: user.email, otp }, // NOTE: dev-only, remove `otp` before production
  });
});

export const verifyEmail = catchAsync(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    throw new AppError(httpStatus.BAD_REQUEST, "Email and OTP are required");
  }

  const user = await User.findOne({
    email: email.toLowerCase().trim(),
  }).select("+otp.code +otp.expiresAt");

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (!user.isOTPValid(otp)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid or expired OTP");
  }

  user.isEmailVerified = true;
  user.clearOTP();

  await user.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Email verified successfully",
  });
});


// export const login = catchAsync(async (req, res) => {
//   const { email, password } = req.body;

//   if (!email || !password) {
//     throw new AppError(httpStatus.BAD_REQUEST, "Email and password required");
//   }

//   const user = await User.findOne({
//     email: email.toLowerCase().trim(),
//   }).select("+password");

//   if (!user) {
//     throw new AppError(httpStatus.NOT_FOUND, "User not found");
//   }

//   if (!user.isEmailVerified) {
//     throw new AppError(httpStatus.FORBIDDEN, "Email not verified");
//   }

//   const match = await user.comparePassword(password);

//   if (!match) {
//     throw new AppError(httpStatus.FORBIDDEN, "Wrong password");
//   }

//   const payload = {
//     _id: user._id,
//     email: user.email,
//     role: user.role,
//   };

//   const accessToken = createToken(
//     payload,
//     process.env.JWT_ACCESS_SECRET,
//     "1d"
//   );

//   const refreshToken = createToken(
//     payload,
//     process.env.JWT_REFRESH_SECRET,
//     "7d"
//   );

//   user.refreshToken = refreshToken;
//   await user.save();

//   sendResponse(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: "Login successful",
//     data: {
//       _id: user._id,
//       name: user.name,
//       email: user.email,
//       phoneNumber: user.phoneNumber,
//       role: user.role,
//       area: user.area,
//       isEmailVerified: user.isEmailVerified,
//       accessToken,
//       refreshToken,
//     },
//   });
// });


export const login = catchAsync(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Email and OTP are required"
    );
  }

  const user = await User.findOne({
    email: email.toLowerCase().trim(),
  }).select("+otp.code +otp.expiresAt");

  if (!user) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "User not found"
    );
  }

  if (!user.isEmailVerified) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Email not verified"
    );
  }

  if (!user.isProfileComplete) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Please complete registration first"
    );
  }

  // Verify OTP
  if (!user.isOTPValid(otp)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Invalid or expired OTP"
    );
  }

  // Clear OTP after successful login
  user.clearOTP();

  const payload = {
    _id: user._id,
    email: user.email,
    role: user.role,
  };

  const accessToken = createToken(
    payload,
    process.env.JWT_ACCESS_SECRET,
    "1d"
  );

  const refreshToken = createToken(
    payload,
    process.env.JWT_REFRESH_SECRET,
    "7d"
  );

  user.refreshToken = refreshToken;

  await user.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Login successful",
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      area: user.area,
      isEmailVerified: user.isEmailVerified,
      accessToken,
      refreshToken,
    },
  });
});

export const forgetPassword = catchAsync(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new AppError(httpStatus.BAD_REQUEST, "Email is required");
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const otp = generateOTP();

  user.setResetPasswordOTP(otp);
  await user.save();

  await sendEmail(user.email, "Reset OTP", `Your OTP is ${otp}`);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "OTP sent",
    data: {
      email: user.email,
      resetOtpVerified: false,
      otp,
    },
  });
});

export const verifyResetPasswordOTP = catchAsync(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    throw new AppError(httpStatus.BAD_REQUEST, "Email and OTP are required");
  }

  const user = await User.findOne({
    email: email.toLowerCase().trim(),
  }).select("+resetPasswordOtp.code +resetPasswordOtp.expiresAt");

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (!user.isResetPasswordOTPValid(otp)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid or expired OTP");
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "OTP verified successfully",
    data: {
      email: user.email,
      resetOtpVerified: true,
    },
  });
});

export const resetPassword = catchAsync(async (req, res) => {
  const { email, otp, password, confirmPassword } = req.body;

  if (!email || !otp || !password || !confirmPassword) {
    throw new AppError(httpStatus.BAD_REQUEST, "All fields required");
  }

  if (password !== confirmPassword) {
    throw new AppError(httpStatus.BAD_REQUEST, "Passwords not match");
  }

  const user = await User.findOne({
    email: email.toLowerCase().trim(),
  }).select("+password +resetPasswordOtp.code +resetPasswordOtp.expiresAt");

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (!user.isResetPasswordOTPValid(otp)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid or expired OTP");
  }

  user.password = password;
  user.clearResetPasswordOTP();

  await user.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password reset successful",
  });
});

export const resendOTP = catchAsync(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new AppError(httpStatus.BAD_REQUEST, "Email is required");
  }

  const user = await User.findOne({
    email: email.toLowerCase().trim(),
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.isEmailVerified) {
    throw new AppError(httpStatus.BAD_REQUEST, "Email already verified");
  }

  const otp = generateOTP();

  user.setOTP(otp);
  await user.save();

  await sendEmail(user.email, "Email Verification OTP", `Your OTP is ${otp}`);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "OTP resent successfully",
    data: {
      email: user.email,
      resetOtpVerified: false,
    },
  });
});

export const logout = catchAsync(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Unauthorized");
  }

  await User.findByIdAndUpdate(userId, {
    refreshToken: "",
  });

  res.clearCookie("refreshToken");

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Logged out successfully",
    data: {},
  });
});