import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

// USER SCHEMA
const userSchema = new mongoose.Schema(
  {
    walletAddress:{
      type: String,
      default: null
    },
    username: {
      type: String,
      lowercase:true
    },
    name: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
    },
    displayEmail: {
      type: Boolean,
      default: false,
    },
    location: {
      type: String,
    },
    image: {
      type: String,
    },
    socials: {
      type: [String],
      default: [],
    },
    website: {
      type: String,
    },
    bio: {
      type: String,
    },
    bannerImage: {
      type: String,
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// add plugin that converts mongoose to json
userSchema.plugin(toJSON);

export default mongoose.models.User || mongoose.model("User", userSchema);
