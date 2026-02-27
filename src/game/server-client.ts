import { getClient, Environment } from "@open-empires/open-empires-api-bindings";

const CLIENT_TOKEN_STORAGE_KEY = "open-empires.spacetimedb.token";
let client: ReturnType<typeof getClient> | null = null;

export async function runSignInModalReducers(name: string = "Alex"): Promise<void> {
  const connection = getOrCreateClient();
  await connection.reducers.add({ name });
  await connection.reducers.sayHello({});
}

function getOrCreateClient(): ReturnType<typeof getClient> {
  if (client) {
    return client;
  }

  client = getClient(resolveEnvironmentFromHostname(window.location.hostname), loadStoredToken(), storeToken);
  return client;
}

function loadStoredToken(): string | undefined {
  return localStorage.getItem(CLIENT_TOKEN_STORAGE_KEY) ?? undefined;
}

function storeToken(token: string): void {
  localStorage.setItem(CLIENT_TOKEN_STORAGE_KEY, token);
}

function resolveEnvironmentFromHostname(hostname: string): Environment {
  const normalizedHost = hostname.toLowerCase();
  if (
    normalizedHost === "localhost" ||
    normalizedHost === "127.0.0.1" ||
    normalizedHost === "[::1]"
  ) {
    return Environment.Development();
  }

  if (normalizedHost === "open-empires.com" || normalizedHost.endsWith(".open-empires.com")) {
    return Environment.Production();
  }

  return Environment.Development();
}
