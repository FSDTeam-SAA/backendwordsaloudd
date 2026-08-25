import mongoose, { Schema } from "mongoose";

const reviewSchema = new Schema(
  {
    tradesman: {
      type: Schema.Types.ObjectId,
      ref: "TradesmanProfile",
      required: true,
      index: true,
    },

    reviewer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    ratingLabel: {
      type: String,
      trim: true,
      default: "",
    },

    reviewText: {
      type: String,
      trim: true,
      default: "",
    },

    moderationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved",
      index: true,
    },
    moderatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    moderatedAt: { type: Date, default: null },
    moderationNote: { type: String, trim: true, default: "" },
  },
  {
    timestamps: true,
  }
);

reviewSchema.index({ tradesman: 1, reviewer: 1 }, { unique: true });

const Review = mongoose.model("Review", reviewSchema);

export default Review;
