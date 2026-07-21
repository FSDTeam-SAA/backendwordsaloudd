import httpStatus from "http-status";
import Review from "../model/review.model.js";
import TradesmanProfile from "../model/tradesmanProfile.model.js";
import AppError from "../errors/AppError.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";

const recalcRating = async (tradesmanId) => {
  const stats = await Review.aggregate([
    { $match: { tradesman: tradesmanId } },
    {
      $group: {
        _id: "$tradesman",
        avg: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  const { avg = 0, count = 0 } = stats[0] || {};

  await TradesmanProfile.findByIdAndUpdate(tradesmanId, {
    ratingAverage: Math.round(avg * 10) / 10,
    ratingCount: count,
  });
};


export const postReview = catchAsync(async (req, res) => {
  const { tradesmanId } = req.params;
  const { rating, ratingLabel, reviewText } = req.body;

  if (!rating) {
    throw new AppError(httpStatus.BAD_REQUEST, "Rating is required");
  }

  const tradesman = await TradesmanProfile.findById(tradesmanId);
  if (!tradesman) {
    throw new AppError(httpStatus.NOT_FOUND, "Tradesman not found");
  }

  const review = await Review.findOneAndUpdate(
    { tradesman: tradesmanId, reviewer: req.user._id },
    { rating, ratingLabel, reviewText },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );

  await recalcRating(tradesmanId);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Review posted",
    data: review,
  });
});

export const getReviewsForTradesman = catchAsync(async (req, res) => {
  const { tradesmanId } = req.params;

  const reviews = await Review.find({ tradesman: tradesmanId })
    .populate("reviewer", "firstName lastName")
    .sort({ createdAt: -1 });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Reviews fetched",
    data: reviews,
  });
});
