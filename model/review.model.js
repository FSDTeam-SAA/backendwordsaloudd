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

    // "Excellent - would recommend" style summary label
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
  },
  {
    timestamps: true,
  }
);

// one review per client per tradesman
reviewSchema.index({ tradesman: 1, reviewer: 1 }, { unique: true });

const Review = mongoose.model("Review", reviewSchema);

export default Review;
