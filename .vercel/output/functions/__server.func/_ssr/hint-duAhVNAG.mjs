import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { T as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as CircleHelp } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/hint-duAhVNAG.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Hint({ children, label = "More information" }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: "hint-wrap relative inline-flex align-middle",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			"aria-label": label,
			"aria-expanded": open,
			onClick: () => setOpen((value) => !value),
			onBlur: () => setOpen(false),
			className: "ml-1 inline-grid size-5 place-items-center rounded-full text-muted hover:bg-mist hover:text-fg focus-visible:outline-2 focus-visible:outline-primary",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleHelp, { className: "size-4" })
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			role: "tooltip",
			className: `hint-popover absolute left-1/2 top-full z-40 mt-2 w-60 -translate-x-1/2 border border-border bg-bg-elevated p-3 text-left text-xs leading-relaxed text-fg shadow-lg ${open ? "is-open" : ""}`,
			children
		})]
	});
}
//#endregion
export { Hint as t };
