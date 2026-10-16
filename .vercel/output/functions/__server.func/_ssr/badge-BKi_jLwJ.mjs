import { n as cn } from "./utils-CSfacMs6.mjs";
import { T as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/badge-BKi_jLwJ.js
var import_jsx_runtime = require_jsx_runtime();
function Badge({ className, tone = "mist", ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium", {
			mist: "bg-mist text-fg",
			sage: "bg-primary text-primary-fg",
			danger: "bg-danger/15 text-danger",
			ink: "bg-ink text-paper"
		}[tone], className),
		...props
	});
}
//#endregion
export { Badge as t };
