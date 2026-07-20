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
    // NOTE: not `required` at schema level on purpose - this profile is built
    // up across multiple onboarding steps (skills -> work-area -> pitch ->
    // go-live), so each intermediate save must not fail full-document
    // validation before later steps have filled in their fields.
    // Completeness is enforced explicitly in the goLive controller instead.
    mainSkill: {
      type: String,
      enum: SKILLS,
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
      trim: true,
    },

    travelRange: {
      type: String,
      enum: TRAVEL_RANGES,
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
// each entry = one profile-detail view timestamp, used to compute
// "Views this week" on the dashboard.
profileViews: {
  type: [Date],
  default: [],
  select: false,
},

// "Need to update? Email support@aturservicett.com" flow
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