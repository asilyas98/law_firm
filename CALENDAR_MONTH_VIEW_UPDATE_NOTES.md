# Calendar Month View Update

This build upgrades the Calendar tab from a simple event list into a 30-day/month-style calendar workspace.

## Added

- Large monthly calendar grid with Sunday-Saturday columns.
- Previous / Today / Next month controls.
- Click any calendar day to select it.
- Event creation panel is tied to the selected day.
- Events appear directly inside each day cell.
- Selected-day event list with remove controls.
- Upcoming event list for quick review.
- Events continue to save in the browser/local workspace via the existing `firstChairCalendarEvents` local storage key.

## Notes

This is still an in-app/local reminder view. It does not yet sync with Google Calendar, Outlook, email, SMS, or push notifications.
