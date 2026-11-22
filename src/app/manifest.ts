import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Patudos",
    short_name: "Patudos",
    description:
      "Saúde, lembretes, despesas e documentos dos teus animais de estimação.",
    lang: "pt-PT",
    dir: "ltr",
    display: "standalone",
    orientation: "portrait",
    start_url: "/",
    scope: "/",
    theme_color: "#0B6B5F",
    background_color: "#F2F5F4",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
