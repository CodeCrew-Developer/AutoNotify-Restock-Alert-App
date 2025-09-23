import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [/.+\@.+\..+/, "Please fill a valid email address"],
    },
    productId: {
      type: String,
      required: true,
    },
    variantId: {
      type: String,
      required: true,
    },
    shopName: {
      type: String,
      required: true,
    },
    autoEmailEnabled: {
      type: Boolean,
      default: false, 
    },
    emailSent: {
      type: Number,
      default: 0, 
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Add compound index for email, productId, variantId, and shopName
userSchema.index({ email: 1, productId: 1, variantId: 1, shopName: 1 }, { unique: true });

// Clear any existing model to avoid conflicts
if (mongoose.models.User) {
  delete mongoose.models.User;
}

// New schema for shop-specific settings
const shopSettingsSchema = new mongoose.Schema(
  {
    shopName: {
      type: String,
      required: true,
      unique: true,
    },
    autoEmailGloballyEnabled: {
      type: Boolean,
      default: false,
    },
    webhookActive: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Clear any existing model to avoid conflicts
if (mongoose.models.ShopSettings) {
  delete mongoose.models.ShopSettings;
}

const User = mongoose.model("User", userSchema);
const ShopSettings = mongoose.model("ShopSettings", shopSettingsSchema);

export { User as default, ShopSettings };