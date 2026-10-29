import { getCurrentUser } from "@/lib/auth-helpers";
import { NavbarWrapper } from "./NavbarWrapper";
import { signOutAction } from "@/actions/auth";

export async function Navbar() {
  const user = await getCurrentUser();
  return <NavbarWrapper user={user ?? undefined} signOutAction={signOutAction} />;
}

