/** @type {import('tailwindcss').Config} */
export default {
	content: [
		"./index.html",
		"./src/**/*.{ts,tsx}",
	],
	theme: {
		extend: {
			colors: {
				brand: {
					DEFAULT: "#0f172a",
					gold: "#b8860b",
					rose: "#e11d48",
				}
			}
		}
	},
	plugins: [],
};
