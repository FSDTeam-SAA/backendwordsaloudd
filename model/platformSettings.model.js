import mongoose, { Schema } from "mongoose";

const platformSettingsSchema = new Schema(
  {
    key: { type: String, unique: true, default: "platform" },
    vipSlotsPerCategory: { type: Number, min: 1, max: 20, default: 3 },
    sponsoredRotation: {
      type: String,
      enum: ["round-robin", "priority", "random"],
      default: "round-robin",
    },
    reviewModerationMode: {
      type: String,
      enum: ["auto-approve", "require-review"],
      default: "auto-approve",
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export default mongoose.model("PlatformSettings", platformSettingsSchema);
