# Coaching Client Dashboard

A simple dashboard for managing your coaching clients and tracking their sessions via Google Calendar.

## Setup

1. **Add your clients** - Edit `config.py` and replace the sample clients with your actual client list
2. **Run the app** - `python app.py`
3. **Login** - Visit http://localhost:5000 and click "Login" to connect to Google Calendar
4. **Use the dashboard** - View your clients, their last/next sessions, and who needs scheduling

## Features

- **Client Overview**: See all your clients in one place
- **Session Tracking**: Automatically finds last and next sessions from Google Calendar
- **Scheduling Alerts**: Highlights clients who need to be scheduled
- **Clean UI**: Modern interface with Tailwind CSS

## How it works

The app searches your Google Calendar for events that contain your clients' email addresses. It looks for:
- Last sessions (past 30 days)
- Next sessions (future dates)
- Clients without upcoming sessions (marked as "needs scheduling")

## Customization

- Edit `config.py` to add/remove clients
- The app will automatically update when you restart it
- No database needed - everything is stored in your Google Calendar 