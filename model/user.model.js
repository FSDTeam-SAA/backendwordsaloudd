import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new Schema(
  {
    firstName: {
      type: String,
      // required: [true, "First name is required"],
      trim: true,
    },

    // Public listings only ever show first name + last initial,
    // matching the "Only your first and last name initial will appear
    // publicly" note on the sign up screen.
    lastName: {
      type: String,
      // required: [true, "Last name is required"],
      trim: true,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },

    phoneNumber: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
      select: false,
    },

    refreshToken: {
      type: String,
      default: null,
      select: false,
    },

    // "I need a tradesman" -> client, "I am a tradesman" -> tradesman
    role: {
      type: String,
      enum: ["client", "tradesman", "admin"],
      default: "client",
    },

    area: {
      type: String,
      trim: true,
      default: "",
    },

    profileImage: {
      public_id: { type: String, default: "" },
      url: { type: String, default: "" },
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    isBlocked: {
      type: Boolean,
      default: false,
    },

    otp: {
      code: { type: String, default: null, select: false },
      expiresAt: { type: Date, default: null, select: false },
    },

    resetPasswordOtp: {
      code: { type: String, default: null, select: false },
      expiresAt: { type: Date, default: null, select: false },
    },
  },
  {
    timestamps: true,
  }
);

// hash password before save
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (plainPassword) {
  return await bcrypt.compare(plainPassword, this.password);
};

userSchema.methods.setOTP = function (code, expireMinutes = 5) {
  this.otp = {
    code,
    expiresAt: new Date(Date.now() + expireMinutes * 60 * 1000),
  };
};

userSchema.methods.clearOTP = function () {
  this.otp = { code: null, expiresAt: null };
};

userSchema.methods.isOTPValid = function (code) {
  return (
    this.otp?.code === code &&
    this.otp?.expiresAt &&
    this.otp.expiresAt > new Date()
  );
};

userSchema.methods.setResetPasswordOTP = function (code, expireMinutes = 5) {
  this.resetPasswordOtp = {
    code,
    expiresAt: new Date(Date.now() + expireMinutes * 60 * 1000),
  };
};

userSchema.methods.clearResetPasswordOTP = function () {
  this.resetPasswordOtp = { code: null, expiresAt: null };
};

userSchema.methods.isResetPasswordOTPValid = function (code) {
  return (
    this.resetPasswordOtp?.code === code &&
    this.resetPasswordOtp?.expiresAt &&
    this.resetPasswordOtp.expiresAt > new Date()
  );
};

userSchema.virtual("name").get(function () {
  return `${this.firstName} ${this.lastName}`.trim();
});

// public display name -> "Adam L." style, used on reviews/listings
userSchema.methods.publicName = function () {
  const lastInitial = this.lastName ? `${this.lastName.charAt(0)}.` : "";
  return `${this.firstName} ${lastInitial}`.trim();
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject({ virtuals: true });
  delete obj.password;
  delete obj.otp;
  delete obj.resetPasswordOtp;
  delete obj.refreshToken;
  return obj;
};

const User = mongoose.model("User", userSchema);

export default User;




