const AUTH_KEY = "enter-auth-session";
const ROLE_KEY = "enter-auth-role";

export const defaultCredentials = {
  username: "abc",
  password: "123",
};

export function login(username, password, role = "advogado") {
  const valid =
    username === defaultCredentials.username &&
    password === defaultCredentials.password;

  if (valid && typeof window !== "undefined") {
    localStorage.setItem(AUTH_KEY, "authenticated");
    localStorage.setItem(ROLE_KEY, role);
  }

  return valid;
}

export function logout() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(ROLE_KEY);
  }
}

export function isAuthenticated() {
  if (typeof window === "undefined") {
    return false;
  }

  return localStorage.getItem(AUTH_KEY) === "authenticated";
}

export function getRole() {
  if (typeof window === "undefined") {
    return "advogado";
  }

  return localStorage.getItem(ROLE_KEY) || "advogado";
}

export function setRole(role) {
  if (typeof window !== "undefined") {
    localStorage.setItem(ROLE_KEY, role);
  }
}
