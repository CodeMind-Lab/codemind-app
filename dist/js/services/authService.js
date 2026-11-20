import { getClient, unwrap } from "./supabase.js?v=65";
export async function session() {
  const c = await getClient();
  return c ? unwrap(await c.auth.getSession())?.session : null;
}
export async function signIn(email, password) {
  return unwrap(
    await (await getClient()).auth.signInWithPassword({ email, password }),
  );
}
export async function signOut() {
  const c = await getClient();
  if (c) unwrap(await c.auth.signOut());
}
export async function resetPassword(email) {
  unwrap(
    await (
      await getClient()
    ).auth.resetPasswordForEmail(email, {
      redirectTo: location.origin + location.pathname + "#/settings",
    }),
  );
}
export async function changePassword(password) {
  unwrap(await (await getClient()).auth.updateUser({ password }));
}
