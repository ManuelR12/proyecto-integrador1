.PHONY: install-back-deps install-front-deps run-front run-back

BACKEND_DIR = cd server
FRONTEND_DIR = cd client

install-back-deps:
	$(BACKEND_DIR) && uv sync

install-front-deps:
	$(FRONTEND_DIR) && npm install

setup-deps: install-back-deps install-front-deps

run-front:
	$(FRONTEND_DIR) && npm run dev

run-back:
	$(BACKEND_DIR) && uv run manage.py runserver

test-e2e:
	$(FRONTEND_DIR) && npx playwright test

test-e2e-ui:
	$(FRONTEND_DIR) && npx playwright test --ui

test-e2e-headed:
	$(FRONTEND_DIR) && npx playwright test --headed

test-e2e-debug:
	$(FRONTEND_DIR) && npx playwright test --debug

test-e2e-path:
	$(FRONTEND_DIR) && npx playwright test --ui "tests/e2e/specs/${test_name}.spec.ts"

run: run-front run-back
