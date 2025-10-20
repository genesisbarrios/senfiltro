import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

// USER SCHEMA
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    username: {
      type: String,
      lowercase:true
    },
    image: {
      type: String,
    },
    walletAddress:{
      type: String,
      default: null
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
