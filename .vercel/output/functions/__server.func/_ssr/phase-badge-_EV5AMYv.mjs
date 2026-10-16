import { o as phaseLabel } from "./utils-CSfacMs6.mjs";
import { T as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as Badge } from "./badge-BKi_jLwJ.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/phase-badge-_EV5AMYv.js
var import_jsx_runtime = require_jsx_runtime();
function PhaseBadge({ phase }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		tone: phase === "cancelled" ? "danger" : phase === "ended" ? "ink" : "sage",
		children: phaseLabel(phase)
	});
}
//#endregion
export { PhaseBadge as t };
