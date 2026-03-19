import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import type { Auth } from "../lib/auth";

export interface RouterContext {
	queryClient: QueryClient;
	auth: Auth;
}

const isDevelopment = import.meta.env.DEV;

const RootComponent = () => (
	<>
		<Outlet />
		{isDevelopment ? <TanStackRouterDevtools position="bottom-right" /> : null}
		{isDevelopment ? <ReactQueryDevtools buttonPosition="bottom-left" /> : null}
	</>
);

export const Route = createRootRouteWithContext<RouterContext>()({
	component: RootComponent,
});
