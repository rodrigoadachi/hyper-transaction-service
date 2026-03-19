import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

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
				target: `${process.env.API_URL || 'http://localhost:3333'}`,
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api/, ""),
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
