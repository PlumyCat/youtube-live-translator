# Task Completion Checklist - YouTube Live Translator

## Before Marking Any Task as Complete

### 1. Code Quality
- [ ] All TypeScript strict mode checks pass
- [ ] No `any` types used (use `unknown` + type guards)
- [ ] All imports follow the standard order (built-ins → external → internal → relative → types)
- [ ] Path aliases used where appropriate (@main, @renderer, @shared, @preload)
- [ ] Proper naming conventions (kebab-case files, PascalCase classes, camelCase functions)

### 2. Error Handling
- [ ] All API calls wrapped in Circuit Breaker pattern
- [ ] Retry logic with exponential backoff implemented
- [ ] Errors properly logged with structured logging (Pino)
- [ ] No empty try-catch blocks
- [ ] Graceful error handling with fallbacks

### 3. Latency Monitoring (CRITICAL)
- [ ] LatencyMonitor used in all pipeline stages
- [ ] Latency logged with stage name and duration
- [ ] Adaptive chunking active if latency > target
- [ ] Cache enabled for repeated translations
- [ ] Profiling data collected for bottlenecks

### 4. Security (Electron)
- [ ] `nodeIntegration: false` in webPreferences
- [ ] `contextIsolation: true` in webPreferences
- [ ] `sandbox: true` in webPreferences
- [ ] All IPC calls validated in preload script
- [ ] No secrets exposed to renderer process
- [ ] All user input sanitized

### 5. Testing
- [ ] Unit tests written for new functions/classes
- [ ] Integration tests for service interactions
- [ ] E2E tests for critical user flows
- [ ] Test coverage maintained at > 80%
- [ ] All tests passing: `npm test`
- [ ] E2E tests passing: `npm run test:e2e`

### 6. Performance
- [ ] No memory leaks (listeners cleaned up)
- [ ] Ring Buffer limits enforced
- [ ] Backpressure handling implemented
- [ ] Streaming used where appropriate
- [ ] Worker threads for CPU-intensive tasks

### 7. Cost Management
- [ ] All API calls tracked in BudgetTracker
- [ ] Cost metrics logged
- [ ] Cache hit ratio > 20% target met
- [ ] Rate limiting applied to prevent overuse

### 8. Code Documentation
- [ ] Complex functions have JSDoc comments
- [ ] Public APIs documented
- [ ] Type definitions clear and self-documenting
- [ ] README updated if needed

## Before Committing Code

### Run these commands:
```bash
npm run lint              # ESLint + TypeScript check
npm run format            # Prettier auto-format
npm test                  # Unit tests
npm run test:coverage     # Verify coverage > 80%
npm run test:e2e          # E2E tests
```

### Verify:
- [ ] All linting errors fixed
- [ ] Code formatted with Prettier
- [ ] All tests passing
- [ ] No console.log statements (use logger instead)
- [ ] No commented-out code
- [ ] No TODO comments without tracking

## Before Creating a Pull Request

- [ ] Branch name descriptive (e.g., `feature/adaptive-chunking`)
- [ ] Commits follow conventional commits format
- [ ] `/review-code` command run in Claude Code
- [ ] Performance benchmarks run if applicable
- [ ] Documentation updated in docs/
- [ ] CHANGELOG.md updated

## Critical Performance Checks

### Latency Targets
- [ ] Total end-to-end latency < 2000ms
- [ ] P50 latency < 1500ms
- [ ] P95 latency < 1900ms

### Cost Targets
- [ ] Monthly API costs < $70 (intensive use)
- [ ] Budget alerts configured
- [ ] Cost tracking logs reviewed

### Quality Targets
- [ ] Test coverage > 80%
- [ ] Cache hit ratio > 20%
- [ ] No security vulnerabilities (npm audit)

## Special Considerations

### When Working with Audio Pipeline
- [ ] Buffer sizes appropriate (not too large/small)
- [ ] Backpressure strategy implemented
- [ ] Adaptive chunk sizing active
- [ ] Stream error handlers in place

### When Working with Cloud Services
- [ ] Circuit Breaker configured (5 failures threshold)
- [ ] Retry logic with max 3 attempts
- [ ] Rate limiting applied
- [ ] Timeout configured (< 5s)
- [ ] Credentials loaded securely from .env

### When Working with React UI
- [ ] useEffect cleanup functions present
- [ ] State updates optimized (no unnecessary re-renders)
- [ ] IPC listeners unsubscribed on unmount
- [ ] Loading states handled
- [ ] Error states displayed to user

## Final Verification

Before marking task as DONE:
- [ ] Feature works end-to-end in dev mode
- [ ] No console errors in Chrome DevTools
- [ ] Memory usage stable (no leaks)
- [ ] Performance meets targets
- [ ] User experience smooth and responsive