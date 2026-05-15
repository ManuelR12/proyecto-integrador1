import { defineConfig, devices } from "@playwright/test";

/**
 * Configuración de Playwright para Luma (client).
 * Docs: https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
	/* Directorio donde viven los tests */
	testDir: "./tests/e2e",

	/* Ejecutar tests en paralelo (dentro de un archivo) */
	fullyParallel: false,

	/* Fallar en CI si se dejó un test.only */
	forbidOnly: !!process.env.CI,

	/* Reintentos: 2 en CI, 0 en local */
	retries: process.env.CI ? 2 : 0,

	/* Workers: 1 en CI, 2 en local para no reventar el equipo */
	workers: process.env.CI ? 1 : 2,

	/* Reporter HTML para ver resultados visualmente */
	reporter: [["html", { open: "never" }]],

	/* Opciones compartidas por todos los tests */
	use: {
		/* URL base — dev server de Vite local */
		baseURL: "http://localhost:5173",

		/* Capturar trace en primer reintento */
		trace: "on-first-retry",

		/* Capturar screenshot al fallar */
		screenshot: "only-on-failure",

		/* Capturar video al fallar */
		video: "retain-on-failure",
	},

	/* Navegadores en los que correr los tests */
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
		/* Firefox desactivado en local para ahorrar recursos — habilitar en CI */
		// {
		// 	name: "firefox",
		// 	use: { ...devices["Desktop Firefox"] },
		// },

		/* Tests en viewports móviles (descomentar si necesitas) */
		// {
		// 	name: "Mobile Chrome",
		// 	use: { ...devices["Pixel 5"] },
		// },
		// {
		// 	name: "Mobile Safari",
		// 	use: { ...devices["iPhone 12"] },
		// },
	],

	/* Levantar el dev server de Vite antes de correr los tests */
	webServer: {
		command: "npm run dev",
		url: "http://localhost:5173",
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
});
