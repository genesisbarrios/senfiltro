import axios from "axios";
import { toast } from "react-hot-toast";
import { signIn } from "next-auth/react";
import config from "../../config";

const apiClient = axios.create({
  baseURL: "/api",
});

apiClient.interceptors.response.use(
  function (response) {
    return response.data;
  },
  function (error) {
    let message = "";

    if (error.response?.status === 401) {
      // Don't force NextAuth signIn for web3 apps.
      toast.error("Please connect your wallet");

      // If you explicitly enabled NextAuth in config, call signIn.
      if ((config as any)?.auth?.useNextAuth) {
        try {
          return signIn(undefined, {
            callbackUrl: config.auth?.callbackUrl ?? "/",
          });
        } catch (e) {
          console.warn("signIn failed", e);
        }
      }

      // Default web3 flow: redirect to a client wallet-connect page
      if (typeof window !== "undefined") {
        const callback = config?.auth?.callbackUrl ?? "/";
        window.location.href = `/connect-wallet?callback=${encodeURIComponent(
          callback
        )}`;
      }

      // Reject so callers see the original error
      return Promise.reject(error);
    } else if (error.response?.status === 403) {
      message = "Pick a plan to use this feature";
    } else {
      message =
        error?.response?.data?.error || error.message || String(error);
    }

    error.message =
      typeof message === "string" ? message : JSON.stringify(message);

    console.error(error.message);

    if (error.message) {
      toast.error(error.message);
    } else {
      toast.error("something went wrong...");
    }
    return Promise.reject(error);
  }
);

export default apiClient;