import { createApp, type Env } from './app'

const app = createApp({ fetch: (...args) => fetch(...args), now: () => new Date() })

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => app.fetch(request, env, ctx),
}
