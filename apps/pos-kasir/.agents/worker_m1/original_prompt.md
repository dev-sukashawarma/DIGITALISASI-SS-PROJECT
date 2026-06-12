## 2026-06-11T07:27:31Z
You are the Worker for M1: Test Infra Fixes.
Reviewer 1 failed the gate with the following issues:
1. `baseURL` is commented out in `playwright.config.ts` (`// baseURL: 'http://localhost:3000'`). Uncomment and set it correctly.
2. `package.json` is missing an e2e test script. Add `"test:e2e": "playwright test"` to the scripts section.

Use `replace_file_content` or `multi_replace_file_content` to make these changes.
NOTE: The user is AFK, so do NOT use `run_command`. Just edit the files statically. Send me a completion message when done.
