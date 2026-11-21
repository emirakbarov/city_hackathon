import { createContext, useContext } from "react";
import type { Profile } from "./pause";

export const MeContext = createContext<Profile | null>(null);
export function useMe(): Profile {
  const me = useContext(MeContext);
  if (!me) throw new Error("useMe outside signed-in area");
  return me;
}
