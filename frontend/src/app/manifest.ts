import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CallMedex",
    short_name: "CallMedex",
    start_url: "/auth/login",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1a2b4a",
    icons: [{ src: "/logo.png", sizes: "905x732", type: "image/png", purpose: "any" }],
  };
}
