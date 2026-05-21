// src/lib/_bundle-test.ts
// =============================================================================
// THROWAWAY — delete after the bundling check.
// =============================================================================
// Purpose: verify that a Vercel Node-runtime function in api/ can import a
// module from src/lib/ and have it resolve at runtime. The repo has no
// existing api/ -> src/ import, so this proves the pattern before we rely on
// it for the shared email template.
//
// How to use:
//   1. Add to ONE existing api/ function, near the top:
//        import { bundleTest } from "../src/lib/_bundle-test";
//      and inside the handler, before anything else:
//        console.log("[bundle-test]", bundleTest());
//   2. Deploy. Trigger that endpoint. Check its Vercel log.
//        - logs "[bundle-test] ok"  -> api/ -> src/lib bundling WORKS
//        - ERR_MODULE_NOT_FOUND     -> it does not; fall back to inlining
//   3. Delete this file and the two test lines once the answer is known.
// =============================================================================

export function bundleTest(): string {
  return "ok";
}
