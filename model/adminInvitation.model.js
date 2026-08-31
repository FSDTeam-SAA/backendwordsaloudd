import mongoose, { Schema } from "mongoose";
import { ADMIN_PERMISSIONS } from "./user.model.js";

const adminInvitationSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    tokenHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "revoked", "expired"],
      default: "pending",
      index: true,
    },
    role: { type: String, enum: ["admin"], default: "admin" },
    permissions: {
      type: [{ type: String, enum: ADMIN_PERMISSIONS }],
      default: ["dashboard"],
    },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    acceptedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

export default mongoose.model("AdminInvitation", adminInvitationSchema);
