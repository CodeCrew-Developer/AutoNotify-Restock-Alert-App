import mongoose from "mongoose";

const emailTemplateSchema = new mongoose.Schema(
  {
    shopName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    createBy: {
      type: String,
      default: "anonymous",
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    fromEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [/.+\@.+\..+/, "Please fill a valid email address"],
    },
    fromName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    post: {
      type: String,
      default: "default_bert",
      trim: true,
    },

    headingColor: { type: String, default: "#000000" },
    headingContent: { type: String, required: true, trim: true },
    headingFontSize: { type: Number, default: 24, min: 12, max: 48 },

    logoImage: { type: String, default: null },
    logoWidth: { type: Number, default: 150, min: 50, max: 300 },
    logoHeight: { type: Number, default: 60, min: 20, max: 150 },

    message: { type: String, required: true, trim: true, maxlength: 1000 },
    messageFontSize: { type: Number, default: 16, min: 10, max: 24 },

    productName: { type: String, required: true, trim: true },
    productPrice: { type: String, required: true, trim: true },
    productNameFontSize: { type: Number, default: 16, min: 10, max: 24 },
    productPriceFontSize: { type: Number, default: 18, min: 10, max: 24 },

    buttonText: { type: String, required: true, trim: true },
    buttonColor: { type: String, default: "#ffffff" },
    buttonBackgroundColor: { type: String, default: "#4CAF50" },
    buttonFontSize: { type: Number, default: 16, min: 10, max: 24 },

    copyright: { type: String, required: true, trim: true },
    footerAlignment: {
      type: String,
      enum: ["left", "center", "right"],
      default: "center",
    },
    footerFontSize: { type: Number, default: 12, min: 8, max: 16 },

    htmlTemplate: { type: String, required: true },

    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export default mongoose.models.EmailTemplate ||
  mongoose.model("EmailTemplate", emailTemplateSchema);
