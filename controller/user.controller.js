import httpStatus from "http-status";
import User from "../model/user.model.js";
import TradesmanProfile from "../model/tradesmanProfile.model.js";
import AppError from "../errors/AppError.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utils/commonMethod.js";

// "Profile" screen
export const getMe = catchAsync(async (req, res) => {
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile fetched",
    data: req.user,
  });
});

// "Edit Profile" screen - name + avatar
export const updateMe = catchAsync(async (req, res) => {
  const { firstName, lastName, area, phoneNumber } = req.body;
  const user = req.user;

  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  if (area !== undefined) user.area = area;
  if (phoneNumber) user.phoneNumber = phoneNumber;

  if (req.file) {
    if (user.profileImage?.public_id) {
      await deleteFromCloudinary(user.profileImage.public_id);
    }
    const result = await uploadOnCloudinary(req.file.buffer, {
      folder: "aturservicett/avatars",
    });
    user.profileImage = { public_id: result.public_id, url: result.secure_url };
  }

  await user.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile updated",
    data: user,
  });
});

// "Change Password" (Settings screen)
export const changePassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmPassword) {
    throw new AppError(httpStatus.BAD_REQUEST, "All fields are required");
  }

  if (newPassword !== confirmPassword) {
    throw new AppError(httpStatus.BAD_REQUEST, "Passwords do not match");
  }

  const user = await User.findById(req.user._id).select("+password");
  const match = await user.comparePassword(currentPassword);
  if (!match) {
    throw new AppError(httpStatus.BAD_REQUEST, "Current password is incorrect");
  }

  user.password = newPassword;
  await user.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password changed successfully",
  });
});

// "Account Management -> Delete Account"
export const deleteMe = catchAsync(async (req, res) => {
  const user = req.user;

  await TradesmanProfile.findOneAndDelete({ user: user._id });
  await User.findByIdAndDelete(user._id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Account deleted successfully",
  });
});
