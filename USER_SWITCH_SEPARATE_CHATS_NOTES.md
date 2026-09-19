# User switch and separate chats

This build makes the Chat tab's "Change user" dropdown behave like a per-user chatbot profile switch.

Behavior:
- Changing the selected user immediately starts a new chat in the UI.
- Recent chats are filtered to the selected user profile.
- New conversations are attributed to the selected profile email in `chat_conversations.created_by_email`.
- If a stale conversation from another user is accidentally sent, the API ignores it and creates a fresh conversation for the selected user.
- No new Supabase columns are required for this behavior.

Notes:
- This is profile switching inside the app. It does not replace real Supabase Auth login isolation.
- For production, each staff member should still have their own login.
