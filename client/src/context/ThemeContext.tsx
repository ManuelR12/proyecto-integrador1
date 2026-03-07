import { createContext } from "react";

export type Theme = "dark" | "light";

export interface ThemeContextType {
	theme: Theme;
	isDark: boolean;
	toggle: () => void;
}

export const ThemeContext = createContext<ThemeContextType>({
	theme: "dark",
	isDark: true,
	toggle: () => {},
});
