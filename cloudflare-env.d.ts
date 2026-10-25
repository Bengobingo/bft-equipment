declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BFT_LOCAL_INSTANCE?: string;
    BUCKET?: R2Bucket;
  }
}
