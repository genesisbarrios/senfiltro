import NextAuth from "next-auth";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
// import { MongoDBAdapter } from "@auth/mongodb-adapter";
import config from "../../config";

interface NextAuthOptionsExtended extends NextAuthOptions {
  adapter?: any;
}

export const authOptions: NextAuthOptionsExtended  = {
  // Set any random key in .env.local
  secret: process.env.NEXTAUTH_SECRET || (() => { throw new Error("NEXTAUTH_SECRET is not defined in environment variables"); })(),
   providers: [
  //   GoogleProvider({
  //     // Follow the "Login with Google" tutorial to get your credentials
  //     clientId: process.env.GOOGLE_ID || (() => { throw new Error("GOOGLE_ID is not defined in environment variables"); })(),
  //     clientSecret: process.env.GOOGLE_SECRET || (() => { throw new Error("GOOGLE_SECRET is not defined in environment variables"); })(),
  //     async profile(profile) {
  //       return {
  //         id: profile.sub,
  //         name: profile.given_name ? profile.given_name : profile.name,
  //         email: profile.email,
  //         image: profile.picture,
  //         createdAt: new Date(),
  //       };
  //     },
  //   }),
  //   // Follow the "Login with Email" tutorial to set up your email server
  //   // Requires a MongoDB database. Set MONOGODB_URI env variable.
  //   ...(connectMongo
  //     ? [
  //         EmailProvider({
  //           server: process.env.EMAIL_SERVER,
  //           from: config.mailgun.fromNoReply,
  //         }),
  //       ]
  //     : []),
   ],
  // New users will be saved in Database (MongoDB Atlas). Each user (model) has some fields like name, email, image, etc..
  // Requires a MongoDB database. Set MONOGODB_URI env variable.
  // Learn more about the model type: https://next-auth.js.org/v3/adapters/models
  // ...(connectMongo && { adapter: MongoDBAdapter(connectMongo) }),

  callbacks: {
    session: async ({ session, token }: { session: any; token: any }) => {
      if (session?.user) {
        session.user.id = token.sub;
        session.user.email = token.email;
        session.user.image = token.picture;
        session.user.walletAddress = token.walletAddress || null;
        session.user.username = token.username || null;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  theme: {
    brandColor: config.colors.main,
    // Add you own logo below. Recommended size is rectangle (i.e. 200x50px) and show your logo + name.
    // It will be used in the login flow to display your logo. If you don't add it, it will look faded.
    logo: `/logo.png`,
  },
};

export default NextAuth(authOptions);
