# Speech Dictation Fix

This update fixes microphone dictation duplicating partial speech results in notes, workflow steps, and chat.

## What changed

- The speech recognizer no longer appends every interim transcript.
- The app now waits for one final transcript before inserting text.
- If the browser ends without a final result, the latest interim transcript is inserted once as a fallback.
- Notes, workflow steps, and chat dictation all share the same safer logic.
- Status messages now clarify that the speech was captured once and should be reviewed.

## Why

Browser speech recognition can emit multiple partial transcripts while the user is still speaking. The previous implementation appended each partial update, which caused repeated lines like:

- so first things first i want
- so first things first i want to
- so first things first i want to ensure that

The new implementation commits only one transcript per microphone session.
