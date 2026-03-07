import { useState, useEffect, type ReactNode } from "react";
import { ThemeContext, type Theme } from "./ThemeContext";

function getInitialTheme(): Theme {
	try {
		const stored = localStorage.getItem("luma_theme") as Theme | null;
		if (stored === "light" || stored === "dark") {
			document.documentElement.setAttribute("data-theme", stored);
			return stored;
		}
	} catch {
		// ignore
	}
	document.documentElement.setAttribute("data-theme", "dark");
	return "dark";
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
	const [theme, setTheme] = useState<Theme>(getInitialTheme);

	useEffect(() => {
		document.documentElement.setAttribute("data-theme", theme);
		try {
			localStorage.setItem("luma_theme", theme);
		} catch {
			// ignore
		}
	}, [theme]);

	const toggle = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));

	return (
		<ThemeContext.Provider value={{ theme, isDark: theme === "dark", toggle }}>
			{children}
		</ThemeContext.Provider>
	);
}
