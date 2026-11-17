// One ENGINE.plan() per message, off the main thread (see the pool in main.js). The plan is plain data.
import { plan } from "./engine.js";

self.onmessage = ({ data: { sk, f, oo } }) => self.postMessage(plan(sk, f, oo));
