import httpStatus from "http-status";
import AdInquiry from "../model/adInquiry.model.js";
import AppError from "../errors/AppError.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";

// "Tell us about your business. We'll be in touch when ad slots open."
export const sendInquiry = catchAsync(async (req, res) => {
  const { businessName, whatsappPhone, tradesToAdvertiseTo } = req.body;

  if (!businessName || !whatsappPhone) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Business name and WhatsApp phone are required"
    );
  }

  const inquiry = await AdInquiry.create({
    user: req.user?._id || null,
    businessName,
    whatsappPhone,
    tradesToAdvertiseTo,
  });

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Inquiry sent. Early inquiries get first pick!",
    data: inquiry,
  });
});

export const getAllInquiries = catchAsync(async (req, res) => {
  const inquiries = await AdInquiry.find().sort({ createdAt: -1 });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Inquiries fetched",
    data: inquiries,
  });
});
