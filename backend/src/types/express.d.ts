import type { PublicUser } from "../auth/types.js";

declare global {
  namespace Express {
    interface Request {
      authUser?: PublicUser;
    }
  }
}

export {};