import { createMiddleware } from "hono/factory";
import type { Env, AppVariables, Role } from "../types";
import { hasPermission, ROLE_PERMISSIONS } from "./auth";

/** Longest-prefix match: URL path → permission resource id (sidebar tab) */
const PATH_RESOURCE_RULES: [prefix: string, resource: string][] = [
  ["/manager", "manager"],
  ["/lo-hang", "lo-hang"],
  ["/doi-tac", "doi-tac"],
  ["/chuyen-xe", "chuyen-xe"],
  ["/nhan-vien", "nhan-vien"],
  ["/cham-cong", "cham-cong"],
  ["/thu-chi", "thu-chi"],
  ["/cong-cu", "cong-cu"],
  ["/tuyen", "tuyen"],
  ["/kho", "kho"],
];

const RESOURCE_HOME: Record<string, string> = {
  dashboard: "/",
  "lo-hang": "/lo-hang",
  "doi-tac": "/doi-tac",
  tuyen: "/tuyen",
  "chuyen-xe": "/chuyen-xe",
  kho: "/kho",
  "nhan-vien": "/nhan-vien",
  "cham-cong": "/cham-cong",
  "thu-chi": "/thu-chi",
  "cong-cu": "/cong-cu",
  manager: "/manager",
};

export function resolveResourceFromPath(path: string): string | null {
  if (
    path === "/" ||
    path === "/dashboard" ||
    path.startsWith("/api/dashboard")
  ) {
    return "dashboard";
  }
  for (const [prefix, resource] of PATH_RESOURCE_RULES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      return resource;
    }
  }
  return null;
}

export function getDefaultHomePath(role: Role): string {
  const tabs = ROLE_PERMISSIONS[role];
  if (!tabs?.length) return "/lo-hang";
  return RESOURCE_HOME[tabs[0]] ?? "/lo-hang";
}

/** Block pages/APIs outside the role's allowed tabs (users.role — not overridable). */
export const rbacMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: AppVariables;
}>(async (c, next) => {
  const user = c.get("user");
  const path = c.req.path;
  const resource = resolveResourceFromPath(path);

  if (resource && !hasPermission(user.role as Role, resource)) {
    const isApi = path.includes("/api/");
    if (isApi) {
      return c.json(
        { error: "Bạn không có quyền truy cập tính năng này" },
        403,
      );
    }
    const home = getDefaultHomePath(user.role as Role);
    return c.redirect(`${home}?denied=${encodeURIComponent(resource)}`);
  }

  await next();
});
