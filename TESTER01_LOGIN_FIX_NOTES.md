# Tester01 Login Fix

This build makes tester01/tester01 work reliably by:

- Allowing built-in workspace logins unless NEXT_PUBLIC_ENABLE_DEMO_MODE is explicitly false.
- Correctly selecting tester01-owner in the tester workspace instead of blank-owner.
- Keeping login hints hidden on the login page.
- Preserving existing demo/demo and blank/blank accounts.
