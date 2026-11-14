.PHONY: demo up down reset test typecheck lint seed

demo: ## Boot infra, migrate, seed, run api+web
	pnpm demo

up:
	pnpm infra:up

down:
	pnpm infra:down

reset: ## Destroy volumes (synthetic data only)
	pnpm infra:reset

test:
	pnpm test

typecheck:
	pnpm typecheck

lint:
	pnpm lint

seed:
	pnpm db:seed
