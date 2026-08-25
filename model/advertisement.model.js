import mongoose, { Schema } from "mongoose";

const advertisementSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    media: {
      mediaType: { type: String, enum: ["image", "video", "none"], default: "none" },
      public_id: { type: String, default: "" },
      url: { type: String, default: "" },
      width: { type: Number, default: 0 },
      height: { type: Number, default: 0 },
      duration: { type: Number, default: 0 },
    },

    targetUrl: { type: String, trim: true, default: "" },
    categories: { type: [String], default: [] },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, default: null },
    priority: { type: Number, min: 0, default: 0 },

    advertiser: {
      name: { type: String, trim: true, default: "" },
      email: { type: String, trim: true, lowercase: true, default: "" },
      phone: { type: String, trim: true, default: "" },
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Advertisement = mongoose.model("Advertisement", advertisementSchema);

export default Advertisement;
