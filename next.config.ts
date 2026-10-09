import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only use standalone output when explicitly running Docker build
  ...(process.env.DOCKER_BUILD ? { output: "standalone" } : {}),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
