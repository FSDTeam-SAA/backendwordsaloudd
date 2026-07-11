// import httpStatus from "http-status";
// import User from "../model/user.model.js";
// import AppError from "../errors/AppError.js";
// import catchAsync from "../utils/catchAsync.js";
// import sendResponse from "../utils/sendResponse.js";
// import { createToken, verifyToken } from "../utils/authToken.js";
// import { generateOTP } from "../utils/commonMethod.js";
// import { sendEmail } from "../utils/sendEmail.js";

// // const issueTokens = (user) => {
// //   const payload = { _id: user._id, email: user.email, role: user.role };

// //   const accessToken = createToken(
// //     payload,
// //     process.env.JWT_ACCESS_SECRET,
// //     process.env.JWT_ACCESS_EXPIRES_IN || "1d"
// //   );

// //   const refreshToken = createToken(
// //     payload,
// //     process.env.JWT_REFRESH_SECRET,
// //     process.env.JWT_REFRESH_EXPIRES_IN || "30d"
// //   );

// //   return { accessToken, refreshToken };
// // };

// // // Step 1 of the "Sign up" screen - covers "Sms Code" resend as well.
// // export const register = catchAsync(async (req, res) => {
// //   const {
// //     firstName,
// //     lastName,
// //     email,
// //     password,
// //     confirmPassword,
// //     phoneNumber,
// //     role,
// //     area,
// //   } = req.body;

// //   if (
// //     !firstName ||
// //     !lastName ||
// //     !email ||
// //     !password ||
// //     !confirmPassword ||
// //     !phoneNumber
// //   ) {
// //     throw new AppError(httpStatus.BAD_REQUEST, "All fields are required");
// //   }

// //   if (password !== confirmPassword) {
// //     throw new AppError(httpStatus.BAD_REQUEST, "Passwords do not match");
// //   }

// //   if (role && !["client", "tradesman"].includes(role)) {
// //     throw new AppError(httpStatus.BAD_REQUEST, "Invalid role");
// //   }

// //   const exists = await User.findOne({ email: email.toLowerCase().trim() });
// //   if (exists) {
// //     throw new AppError(httpStatus.BAD_REQUEST, "Email already exists");
// //   }

// //   const user = await User.create({
// //     firstName,
// //     lastName,
// //     email: email.toLowerCase().trim(),
// //     password,
// //     phoneNumber,
// //     role: role || "client",
// //     area: area || "",
// //   });

// //   const otp = generateOTP();
// //   user.setOTP(otp);
// //   await user.save();

// //   await sendEmail(
// //     user.email,
// //     "Verify your Aturservicett account",
// //     `<p>Your verification code is <b>${otp}</b>. It expires in 5 minutes.</p>`
// //   );

// //   sendResponse(res, {
// //     statusCode: httpStatus.CREATED,
// //     success: true,
// //     message: "Registered successfully. A verification code was sent to your email.",
// //     data: {
// //       _id: user._id,
// //       email: user.email,
// //       role: user.role,
// //       otp, // NOTE: dev-only, remove before production
// //     },
// //   });
// // });

// // export const resendOtp = catchAsync(async (req, res) => {
// //   const { email } = req.body;
// //   if (!email) throw new AppError(httpStatus.BAD_REQUEST, "Email is required");

// //   const user = await User.findOne({ email: email.toLowerCase().trim() });
// //   if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

// //   const otp = generateOTP();
// //   user.setOTP(otp);
// //   await user.save();

// //   await sendEmail(
// //     user.email,
// //     "Your new verification code",
// //     `<p>Your verification code is <b>${otp}</b>. It expires in 5 minutes.</p>`
// //   );

// //   sendResponse(res, {
// //     statusCode: httpStatus.OK,
// //     success: true,
// //     message: "OTP resent",
// //     data: { email: user.email, otp },
// //   });
// // });

// // export const verifyEmail = catchAsync(async (req, res) => {
// //   const { email, otp } = req.body;
// //   if (!email || !otp) {
// //     throw new AppError(httpStatus.BAD_REQUEST, "Email and OTP are required");
// //   }

// //   const user = await User.findOne({ email: email.toLowerCase().trim() });
// //   if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

// //   if (!user.isOTPValid(otp)) {
// //     throw new AppError(httpStatus.BAD_REQUEST, "Invalid or expired OTP");
// //   }

// //   user.isEmailVerified = true;
// //   user.clearOTP();
// //   await user.save();

// //   const { accessToken, refreshToken } = issueTokens(user);
// //   user.refreshToken = refreshToken;
// //   await user.save();

// //   sendResponse(res, {
// //     statusCode: httpStatus.OK,
// //     success: true,
// //     message: "Email verified successfully",
// //     data: { user, accessToken, refreshToken },
// //   });
// // });

// // export const login = catchAsync(async (req, res) => {
// //   const { email, password } = req.body;
// //   if (!email || !password) {
// //     throw new AppError(httpStatus.BAD_REQUEST, "Email and password are required");
// //   }

// //   const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
// //     "+password"
// //   );
// //   if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

// //   if (user.isBlocked) {
// //     throw new AppError(httpStatus.FORBIDDEN, "This account has been blocked");
// //   }

// //   const match = await user.comparePassword(password);
// //   if (!match) throw new AppError(httpStatus.UNAUTHORIZED, "Wrong password");

// //   if (!user.isEmailVerified) {
// //     throw new AppError(httpStatus.FORBIDDEN, "Please verify your email first");
// //   }

// //   const { accessToken, refreshToken } = issueTokens(user);
// //   user.refreshToken = refreshToken;
// //   await user.save();

// //   sendResponse(res, {
// //     statusCode: httpStatus.OK,
// //     success: true,
// //     message: "Login successful",
// //     data: { user, accessToken, refreshToken },
// //   });
// // });

// // export const forgotPassword = catchAsync(async (req, res) => {
// //   const { email } = req.body;
// //   if (!email) throw new AppError(httpStatus.BAD_REQUEST, "Email is required");

// //   const user = await User.findOne({ email: email.toLowerCase().trim() });
// //   if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

// //   const otp = generateOTP();
// //   user.setResetPasswordOTP(otp);
// //   await user.save();

// //   await sendEmail(
// //     user.email,
// //     "Reset your password",
// //     `<p>Your password reset code is <b>${otp}</b>. It expires in 5 minutes.</p>`
// //   );

// //   sendResponse(res, {
// //     statusCode: httpStatus.OK,
// //     success: true,
// //     message: "OTP sent to your email",
// //     data: { email: user.email, otp },
// //   });
// // });

// // export const verifyResetPasswordOtp = catchAsync(async (req, res) => {
// //   const { email, otp } = req.body;
// //   if (!email || !otp) {
// //     throw new AppError(httpStatus.BAD_REQUEST, "Email and OTP are required");
// //   }

// //   const user = await User.findOne({ email: email.toLowerCase().trim() });
// //   if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

// //   if (!user.isResetPasswordOTPValid(otp)) {
// //     throw new AppError(httpStatus.BAD_REQUEST, "Invalid or expired OTP");
// //   }

// //   sendResponse(res, {
// //     statusCode: httpStatus.OK,
// //     success: true,
// //     message: "OTP verified. You may now reset your password.",
// //     data: { email: user.email },
// //   });
// // });

// // export const resetPassword = catchAsync(async (req, res) => {
// //   const { email, otp, newPassword, confirmPassword } = req.body;
// //   if (!email || !otp || !newPassword || !confirmPassword) {
// //     throw new AppError(httpStatus.BAD_REQUEST, "All fields are required");
// //   }

// //   if (newPassword !== confirmPassword) {
// //     throw new AppError(httpStatus.BAD_REQUEST, "Passwords do not match");
// //   }

// //   const user = await User.findOne({ email: email.toLowerCase().trim() });
// //   if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

// //   if (!user.isResetPasswordOTPValid(otp)) {
// //     throw new AppError(httpStatus.BAD_REQUEST, "Invalid or expired OTP");
// //   }

// //   user.password = newPassword;
// //   user.clearResetPasswordOTP();
// //   await user.save();

// //   sendResponse(res, {
// //     statusCode: httpStatus.OK,
// //     success: true,
// //     message: "Password reset successfully",
// //   });
// // });

// // export const refreshAccessToken = catchAsync(async (req, res) => {
// //   const { refreshToken } = req.body;
// //   if (!refreshToken) {
// //     throw new AppError(httpStatus.BAD_REQUEST, "Refresh token is required");
// //   }

// //   let decoded;
// //   try {
// //     decoded = verifyToken(refreshToken, process.env.JWT_REFRESH_SECRET);
// //   } catch (error) {
// //     throw new AppError(httpStatus.UNAUTHORIZED, "Invalid or expired refresh token");
// //   }

// //   const user = await User.findById(decoded._id).select("+refreshToken");
// //   if (!user || user.refreshToken !== refreshToken) {
// //     throw new AppError(httpStatus.UNAUTHORIZED, "Invalid refresh token");
// //   }

// //   const accessToken = createToken(
// //     { _id: user._id, email: user.email, role: user.role },
// //     process.env.JWT_ACCESS_SECRET,
// //     process.env.JWT_ACCESS_EXPIRES_IN || "1d"
// //   );

// //   sendResponse(res, {
// //     statusCode: httpStatus.OK,
// //     success: true,
// //     message: "Access token refreshed",
// //     data: { accessToken },
// //   });
// // });

// // // "Are you sure to log out?" screen
// // export const logout = catchAsync(async (req, res) => {
// //   req.user.refreshToken = null;
// //   await req.user.save();

// //   sendResponse(res, {
// //     statusCode: httpStatus.OK,
// //     success: true,
// //     message: "Logged out successfully",
// //   });
// // });






// export const register = catchAsync(async (req, res) => {
//   const {
//     name,
//     email,
//     password,
//     confirmPassword,
//     phoneNumber,
//     role,
//   } = req.body;

//   if (!name || !email || !password || !confirmPassword) {
//     throw new AppError(httpStatus.BAD_REQUEST, "All fields required");
//   }

//   if (password !== confirmPassword) {
//     throw new AppError(httpStatus.BAD_REQUEST, "Passwords not match");
//   }

//   const exists = await User.findOne({ email: email.toLowerCase().trim() });
//   if (exists) {
//     throw new AppError(httpStatus.BAD_REQUEST, "Email already exists");
//   }

//   const user = await User.create({
//     name,
//     email: email.toLowerCase().trim(),
//     password,
//     phoneNumber,
//     role: role || "user", 
//   });

//   const otp = generateOTP();

//   user.setOTP(otp);
//   await user.save();

//   await sendEmail(user.email, "Email Verification OTP", `Your OTP is ${otp}`);

//   sendResponse(res, {
//     statusCode: httpStatus.CREATED,
//     success: true,
//     message: "Registered successfully. Verify OTP sent to email.",
//     data: {
//       email: user.email,
//       role: user.role,
//       otp,
     
//     },
//   });
// });

// export const verifyEmail = catchAsync(async (req, res) => {
//   const { email, otp } = req.body;

//   if (!email || !otp) {
//     throw new AppError(httpStatus.BAD_REQUEST, "Email and OTP are required");
//   }

//   const user = await User.findOne({ email: email.toLowerCase().trim() });

//   if (!user) {
//     throw new AppError(httpStatus.NOT_FOUND, "User not found");
//   }

//   if (!user.isOTPValid(otp)) {
//     throw new AppError(httpStatus.BAD_REQUEST, "Invalid or expired OTP");
//   }

//   user.isEmailVerified = true;
//   user.clearOTP();

//   await user.save();

//   sendResponse(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: "Email verified successfully",
//   });
// });

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
//       isEmailVerified: user.isEmailVerified,
//       accessToken,
//       refreshToken,
//     },
//   });
// });

// export const forgetPassword = catchAsync(async (req, res) => {
//   const { email } = req.body;

//   if (!email) {
//     throw new AppError(httpStatus.BAD_REQUEST, "Email is required");
//   }

//   const user = await User.findOne({ email: email.toLowerCase().trim() });

//   if (!user) {
//     throw new AppError(httpStatus.NOT_FOUND, "User not found");
//   }

//   const otp = generateOTP();

//   user.setResetPasswordOTP(otp);
//   await user.save();

//   await sendEmail(user.email, "Reset OTP", `Your OTP is ${otp}`);

//   sendResponse(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: "OTP sent",
//     data: {
//       email: user.email,
//       resetOtpVerified: false,
//     },
//   });
// });

// export const verifyResetPasswordOTP = catchAsync(async (req, res) => {
//   const { email, otp } = req.body;

//   if (!email || !otp) {
//     throw new AppError(httpStatus.BAD_REQUEST, "Email and OTP are required");
//   }

//   const user = await User.findOne({
//     email: email.toLowerCase().trim(),
//   });

//   if (!user) {
//     throw new AppError(httpStatus.NOT_FOUND, "User not found");
//   }

//   if (!user.isResetPasswordOTPValid(otp)) {
//     throw new AppError(httpStatus.BAD_REQUEST, "Invalid or expired OTP");
//   }

//   sendResponse(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: "OTP verified successfully",
//     data: {
//       email: user.email,
//       resetOtpVerified: true,
//     },
//   });
// });

// export const resetPassword = catchAsync(async (req, res) => {
//   const { email, otp, password, confirmPassword } = req.body;

//   if (!email || !otp || !password || !confirmPassword) {
//     throw new AppError(httpStatus.BAD_REQUEST, "All fields required");
//   }

//   if (password !== confirmPassword) {
//     throw new AppError(httpStatus.BAD_REQUEST, "Passwords not match");
//   }

//   const user = await User.findOne({
//     email: email.toLowerCase().trim(),
//   }).select("+password");

//   if (!user) {
//     throw new AppError(httpStatus.NOT_FOUND, "User not found");
//   }

//   if (!user.isResetPasswordOTPValid(otp)) {
//     throw new AppError(httpStatus.BAD_REQUEST, "Invalid or expired OTP");
//   }

//   user.password = password;
//   user.clearResetPasswordOTP();

//   await user.save();

//   sendResponse(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: "Password reset successful",
//   });
// });

// export const resendOTP = catchAsync(async (req, res) => {
//   const { email } = req.body;

//   if (!email) {
//     throw new AppError(httpStatus.BAD_REQUEST, "Email is required");
//   }

//   const user = await User.findOne({
//     email: email.toLowerCase().trim(),
//   });

//   if (!user) {
//     throw new AppError(httpStatus.NOT_FOUND, "User not found");
//   }

//   if (user.isEmailVerified) {
//     throw new AppError(httpStatus.BAD_REQUEST, "Email already verified");
//   }

//   const otp = generateOTP();

//   user.setOTP(otp);
//   await user.save();

//   await sendEmail(user.email, "Email Verification OTP", `Your OTP is ${otp}`);

//   sendResponse(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: "OTP resent successfully",
//     data: {
//       email: user.email,
//       resetOtpVerified: false,
//     },
//   });
// });

// export const logout = catchAsync(async (req, res) => {
//   const userId = req.user?._id;

//   if (!userId) {
//     throw new AppError(httpStatus.UNAUTHORIZED, "Unauthorized");
//   }

//   await User.findByIdAndUpdate(userId, {
//     refreshToken: "",
//   });

//   res.clearCookie("refreshToken");

//   sendResponse(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: "Logged out successfully",
//     data: {},
//   });
// });




import httpStatus from "http-status";
import User from "../model/user.model.js";
import AppError from "../errors/AppError.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import { createToken, verifyToken } from "../utils/authToken.js";
import { generateOTP } from "../utils/commonMethod.js";
import { sendEmail } from "../utils/sendEmail.js";



export const register = catchAsync(async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    password,
    confirmPassword,
    phoneNumber,
    role,
    area,
  } = req.body;

  if (!firstName || !lastName || !email || !password || !confirmPassword) {
    throw new AppError(httpStatus.BAD_REQUEST, "All fields required");
  }

  if (password !== confirmPassword) {
    throw new AppError(httpStatus.BAD_REQUEST, "Passwords not match");
  }

  const exists = await User.findOne({ email: email.toLowerCase().trim() });
  if (exists) {
    throw new AppError(httpStatus.BAD_REQUEST, "Email already exists");
  }

  const user = await User.create({
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: email.toLowerCase().trim(),
    password,
    phoneNumber,
    area: area ? area.trim() : "",
    role: ["client", "tradesman", "admin"].includes(role) ? role : "client",
  });

  const otp = generateOTP();

  user.setOTP(otp);
  await user.save();

  await sendEmail(user.email, "Email Verification OTP", `Your OTP is ${otp}`);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Registered successfully. Verify OTP sent to email.",
    data: {
      email: user.email,
      role: user.role,
      otp,
    },
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

export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError(httpStatus.BAD_REQUEST, "Email and password required");
  }

  const user = await User.findOne({
    email: email.toLowerCase().trim(),
  }).select("+password");

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (!user.isEmailVerified) {
    throw new AppError(httpStatus.FORBIDDEN, "Email not verified");
  }

  const match = await user.comparePassword(password);

  if (!match) {
    throw new AppError(httpStatus.FORBIDDEN, "Wrong password");
  }

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