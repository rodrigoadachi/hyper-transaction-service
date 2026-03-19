import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const registrationSecret = process.env.REGISTRATION_SECRET;

export default defineConfig({
	envDir: resolve(__dirname, "../../"),
	plugins: [
		TanStackRouterVite({
			routesDirectory: "./src/pages",
			generatedRouteTree: "./src/routeTree.gen.ts",
		}),
		react(),
		tailwindcss(),
	],
	resolve: {
		alias: {
			"@": resolve(__dirname, "./src"),
		},
	},
	server: {
		port: Number(process.env.WEB_PORT) || 3000,
		proxy: {
			"/api": {
				target: process.env.API_URL,
				changeOrigin: true,
				configure: (proxy) => {
					proxy.on("proxyReq", (proxyReq, req) => {
						if (req.method !== "POST" || !req.url?.startsWith("/api/auth/register")) {
							return;
						}

						if (!registrationSecret) {
							throw new Error("REGISTRATION_SECRET is required to proxy POST /api/auth/register in development");
						}

						proxyReq.setHeader("x-registration-token", registrationSecret);
					});
				},
				rewrite: (path) => {
					console.log("Proxying request:", path);
					return path.replace(/^\/api/, "");
				},
			},
		},
	},
	optimizeDeps: {
		include: [
			"input-otp",
			"react-day-picker",
		],
	},
});
