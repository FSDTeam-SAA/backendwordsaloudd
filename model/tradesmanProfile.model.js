import mongoose, { Schema } from "mongoose";
import { SKILLS, TRAVEL_RANGES, RATE_UNITS } from "../constants/skills.js";

const tradesmanProfileSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    // "Tap your main first, then two extras" - main skill + up to 2 extras
    mainSkill: {
      type: String,
      enum: SKILLS,
      required: true,
    },

    extraSkills: {
      type: [{ type: String, enum: SKILLS }],
      validate: {
        validator: (arr) => arr.length <= 2,
        message: "You can pick at most 2 extra skills",
      },
      default: [],
    },

    homeArea: {
      type: String,
      required: true,
      trim: true,
    },

    travelRange: {
      type: String,
      enum: TRAVEL_RANGES,
      required: true,
    },

    // "Tell clients about yourself. Keep it real. 140 chars."
    pitch: {
      type: String,
      trim: true,
      maxlength: 140,
      default: "",
    },

    typicalRate: {
      amount: { type: Number, min: 0, default: 0 },
      unit: { type: String, enum: RATE_UNITS, default: "Per day" },
    },

    workPhotos: [
      {
        public_id: { type: String, default: "" },
        url: { type: String, default: "" },
      },
    ],

    // Pending verification -> Live, shown on the "You're live!" screen
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },

    isLive: {
      type: Boolean,
      default: false,
    },

    isVip: {
      type: Boolean,
      default: false,
    },

    ratingAverage: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    ratingCount: {
      type: Number,
      default: 0,
    },

    jobsCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

tradesmanProfileSchema.index({ mainSkill: 1 });
tradesmanProfileSchema.index({ homeArea: 1 });
tradesmanProfileSchema.index({ ratingAverage: -1 });

const TradesmanProfile = mongoose.model(
  "TradesmanProfile",
  tradesmanProfileSchema
);

export default TradesmanProfile;
