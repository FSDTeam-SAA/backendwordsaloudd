import mongoose, { Schema } from "mongoose";

const adInquirySchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    businessName: {
      type: String,
      required: true,
      trim: true,
    },

    whatsappPhone: {
      type: String,
      required: true,
      trim: true,
    },

    // tradesToAdvertiseTo: {
    //   type: String,
    //   trim: true,
    //   default: "",
    // },

    tradesToAdvertiseTo: {
      type: [String],   
      default: [],        
},

    status: {
      type: String,
      enum: ["new", "contacted", "closed"],
      default: "new",
    },
  },
  {
    timestamps: true,
  }
);

const AdInquiry = mongoose.model("AdInquiry", adInquirySchema);

export default AdInquiry;
