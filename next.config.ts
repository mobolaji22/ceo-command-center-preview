import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The room photographs are served at three qualities: 55 for the small door previews, 70 for the large backdrops, 75 elsewhere.
  images: { qualities: [55, 70, 75] },
};

export default nextConfig;
