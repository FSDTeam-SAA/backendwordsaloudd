import mongoose, { Schema } from "mongoose";
import { TRAVEL_RANGES, RATE_UNITS } from "../constants/skills.js";

const tradesmanProfileSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    mainSkill: {
      type: String,
      trim: true,
    },

    extraSkills: {
      type: [{ type: String, trim: true }],
      validate: {
        validator: (arr) => arr.length <= 2,
        message: "You can pick at most 2 extra skills",
      },
      default: [],
    },

    homeArea: {
      type: String,
      trim: true,
    },

    travelRange: {
      type: String,
      enum: TRAVEL_RANGES,
    },

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

    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },

    verification: {
      reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
      reviewedAt: { type: Date, default: null },
      rejectionReason: { type: String, trim: true, default: "" },
      submittedAt: { type: Date, default: Date.now },
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
    profileViews: {
      type: [Date],
      default: [],
      select: false,
},

contactChangeRequest: {
  requestedName: { type: String, default: "" },
  requestedPhoneNumber: { type: String, default: "" },
  reason: { type: String, default: "" },
  status: {
    type: String,
    enum: ["none", "pending", "resolved"],
    default: "none",
  },
  requestedAt: { type: Date, default: null },
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
