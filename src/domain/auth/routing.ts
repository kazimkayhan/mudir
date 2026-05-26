const PUBLIC_PATHS = new Set(["/activate", "/welcome", "/login", "/setup"]);

interface AuthRouteInput {
  authed: boolean;
  hasUsers: boolean;
  licenseOk: boolean;
  onboardingCompleted: boolean;
  pathname: string;
  welcomeDone: boolean;
}

function postActivatePath(welcomeDone: boolean, hasUsers: boolean): string {
  if (!welcomeDone) {
    return "/welcome";
  }
  return hasUsers ? "/login" : "/setup";
}

export function resolveAuthRedirect(input: AuthRouteInput): string | null {
  const {
    authed,
    hasUsers,
    licenseOk,
    onboardingCompleted,
    pathname,
    welcomeDone,
  } = input;

  if (!licenseOk) {
    return pathname === "/activate" ? null : "/activate";
  }

  if (pathname === "/activate") {
    return postActivatePath(welcomeDone, hasUsers);
  }

  if (!welcomeDone && pathname !== "/welcome") {
    return "/welcome";
  }

  if (welcomeDone && !hasUsers && pathname !== "/setup") {
    return "/setup";
  }

  if (!(authed || PUBLIC_PATHS.has(pathname))) {
    return "/login";
  }

  if (authed && !onboardingCompleted && pathname !== "/setup") {
    return "/setup";
  }

  if (
    authed &&
    onboardingCompleted &&
    (pathname === "/login" || pathname === "/setup" || pathname === "/welcome")
  ) {
    return "/dashboard";
  }

  return null;
}

export function isPublicAuthPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}
