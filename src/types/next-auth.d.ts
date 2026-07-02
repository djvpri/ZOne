import { DefaultSession } from "next-auth";

// Augmentasi tipe NextAuth -- field `role` (dan `faceId`) di-assign secara
// manual di callback `session()` (lihat src/lib/auth.ts), tapi tipe bawaan
// NextAuth cuma tau id/name/email/image. Tanpa file ini, setiap kode baru
// yang akses session.user.role bakal ketolak TypeScript (TS2339), dan harus
// tempel `as any` manual satu-satu. Dengan augmentasi ini, session.user.role
// jadi valid dipakai langsung di seluruh project.
declare module "next-auth" {
  interface User {
    role?: string;
    faceId?: string | null;
  }

  interface Session {
    user: {
      role?: string;
      faceId?: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    faceId?: string | null;
  }
}
