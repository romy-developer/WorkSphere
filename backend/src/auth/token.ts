import { jwtVerify, SignJWT } from "jose";

const TOKEN_ISSUER = "worksphere-api";
const TOKEN_AUDIENCE = "worksphere-web";
export const SESSION_TTL_SECONDS = 15 * 60;

export interface SessionClaims {
  userId: string;
  sessionVersion: number;
}

export class SessionTokenService {
  private readonly key: Uint8Array;

  constructor(secret: string) {
    if (Buffer.byteLength(secret, "utf8") < 32 || /^REPLACE_WITH/i.test(secret)) {
      throw new Error("AUTH_TOKEN_SECRET must be a random value of at least 32 bytes.");
    }

    this.key = new TextEncoder().encode(secret);
  }

  async issue(userId: string, sessionVersion: number): Promise<string> {
    return new SignJWT({ sessionVersion })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer(TOKEN_ISSUER)
      .setAudience(TOKEN_AUDIENCE)
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
      .sign(this.key);
  }

  async verify(token: string): Promise<SessionClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: ["HS256"],
        issuer: TOKEN_ISSUER,
        audience: TOKEN_AUDIENCE,
      });

      if (
        typeof payload.sub !== "string" ||
        typeof payload.sessionVersion !== "number" ||
        !Number.isInteger(payload.sessionVersion)
      ) {
        return null;
      }

      return {
        userId: payload.sub,
        sessionVersion: payload.sessionVersion,
      };
    } catch {
      return null;
    }
  }
}