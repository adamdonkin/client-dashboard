from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
from flask_session import Session
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from datetime import datetime, timedelta, timezone
import json
import os
import secrets
from config import SUPABASE_URL, SUPABASE_KEY, SUPABASE_TABLE, CALENDAR_ID
from supabase import create_client, Client
from cachelib import SimpleCache

app = Flask(__name__)
app.secret_key = secrets.token_hex(16)
app.config['SESSION_TYPE'] = 'filesystem'
Session(app)

# Initialize cache
cache = SimpleCache()

# Allow OAuth to work with HTTP for local development
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Google OAuth configuration
SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']
CLIENT_SECRETS_FILE = "client_secret_100442766788-a19uma1jtb4dda8ab5nkan3erqcena1g.apps.googleusercontent.com.json"

def get_google_calendar_service():
    """Get Google Calendar service if user is authenticated"""
    if 'credentials' not in session:
        return None
    
    credentials = Credentials(**session['credentials'])
    return build('calendar', 'v3', credentials=credentials)

def get_clients_from_supabase():
    """Get all clients from Supabase"""
    try:
        response = supabase.table(SUPABASE_TABLE).select("*").execute()
        return response.data
    except Exception as e:
        print(f"Error fetching clients from Supabase: {e}")
        return []

@app.route('/')
def index():
    """Main dashboard page"""
    if 'credentials' not in session:
        return redirect(url_for('login'))
    
    # Get calendar service
    service = get_google_calendar_service()
    if not service:
        return redirect(url_for('login'))
    
    # Get client data from Supabase
    clients = get_clients_from_supabase()
    
    # Get client data with session information
    clients_with_sessions, total_sessions_sum = get_clients_with_sessions(service, clients)
    
    return render_template('dashboard.html', clients=clients_with_sessions, total_sessions_sum=total_sessions_sum)

@app.route('/login')
def login():
    """Google OAuth login"""
    flow = Flow.from_client_secrets_file(
        CLIENT_SECRETS_FILE,
        scopes=SCOPES,
        redirect_uri='http://127.0.0.1:5001/callback'
    )
    
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true'
    )
    
    session['oauth_state'] = state
    return redirect(authorization_url)

@app.route('/callback')
def oauth2callback():
    """Callback after Google authentication."""
    state = session.get('oauth_state')
    
    flow = Flow.from_client_secrets_file(
        CLIENT_SECRETS_FILE,
        scopes=SCOPES,
        state=state
    )
    flow.redirect_uri = url_for('oauth2callback', _external=True)

    authorization_response = request.url
    flow.fetch_token(authorization_response=authorization_response)

    credentials = flow.credentials
    session['credentials'] = {
        'token': credentials.token,
        'refresh_token': credentials.refresh_token,
        'token_uri': credentials.token_uri,
        'client_id': credentials.client_id,
        'client_secret': credentials.client_secret,
        'scopes': credentials.scopes
    }
    
    return redirect(url_for('index'))

@app.route('/logout')
def logout():
    """Logout and clear session"""
    session.clear()
    return redirect(url_for('index'))

# Client Management Routes
@app.route('/clients')
def clients():
    """Client management page"""
    if 'credentials' not in session:
        return redirect(url_for('login'))
    
    clients = get_clients_from_supabase()
    return render_template('clients.html', clients=clients)

@app.route('/api/clients', methods=['GET'])
def api_get_clients():
    """API endpoint to get all clients"""
    clients = get_clients_from_supabase()
    return jsonify(clients)

@app.route('/api/clients', methods=['POST'])
def api_create_client():
    """API endpoint to create a new client"""
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'Invalid JSON payload'}), 400
        # Ensure required fields
        required_fields = ['name', 'email']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Set default values
        data['status'] = data.get('status', 'active')
        data['created_at'] = datetime.now().isoformat()
        data['updated_at'] = datetime.now().isoformat()
        
        response = supabase.table(SUPABASE_TABLE).insert(data).execute()
        return jsonify(response.data[0]), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/clients/<int:client_id>', methods=['PUT'])
def api_update_client(client_id):
    """API endpoint to update a client"""
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'Invalid JSON payload'}), 400
        data['updated_at'] = datetime.now().isoformat()
        
        response = supabase.table(SUPABASE_TABLE).update(data).eq('id', client_id).execute()
        return jsonify(response.data[0])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/clients/<int:client_id>', methods=['DELETE'])
def api_delete_client(client_id):
    """API endpoint to delete a client"""
    try:
        supabase.table(SUPABASE_TABLE).delete().eq('id', client_id).execute()
        return jsonify({'message': 'Client deleted successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def get_clients_with_sessions(service, clients):
    """Adds last and next session, and total session count to each client."""
    clients_with_sessions = []
    total_sessions_sum = 0
    for client in clients:
        # Fetch all events for the client in the last 90 days
        now = datetime.utcnow().isoformat() + 'Z'
        ninety_days_ago = (datetime.utcnow() - timedelta(days=90)).isoformat() + 'Z'
        user_email = 'adam@mocharymethod.com'
        all_events = []
        page_token = None
        while True:
            events_result = service.events().list(
                calendarId=CALENDAR_ID,
                timeMin=ninety_days_ago,
                timeMax=now,
                maxResults=250,
                singleEvents=True,
                orderBy='startTime',
                pageToken=page_token
            ).execute()
            events = events_result.get('items', [])
            all_events.extend(events)
            page_token = events_result.get('nextPageToken')
            if not page_token:
                break
        # Find all events with both emails
        matching_events = []
        for event in all_events:
            attendees = set(a['email'] for a in event.get('attendees', []) if 'email' in a)
            if user_email in attendees and client['email'] in attendees:
                if 'matt@mocharymethod.com' in attendees:
                    continue
                start = event['start'].get('dateTime') or event['start'].get('date')
                matching_events.append({
                    'date': start,
                    'summary': event.get('summary', '')
                })
        # Add last session, next session, and session count to client
        client['last_session'] = None
        if matching_events:
            matching_events.sort(key=lambda e: e['date'], reverse=True)
            client['last_session'] = matching_events[0]
        client['next_session'] = get_next_session(service, client['email'])
        client['needs_scheduling'] = not client['next_session']
        client['session_count'] = len(matching_events)
        total_sessions_sum += client['session_count']
        clients_with_sessions.append(client)
    # Sort: clients needing scheduling first (sorted by name), then by next session date
    clients_with_sessions.sort(key=lambda x: (
        not x['needs_scheduling'],
        x['name'].lower() if x['needs_scheduling'] else (x['next_session']['date'] if x.get('next_session') and x['next_session'].get('date') else datetime.max.replace(tzinfo=timezone.utc))
    ))
    return clients_with_sessions, total_sessions_sum

@app.template_filter('format_date')
def format_date(value):
    if not value:
        return "None"
    try:
        # Try parsing as datetime (with or without timezone)
        if 'T' in value:
            # Handle Zulu time (UTC)
            if value.endswith('Z'):
                value = value.replace('Z', '+00:00')
            return datetime.fromisoformat(value).strftime('%b %d, %Y %I:%M%p')
        else:
            # Parse as date only
            return datetime.strptime(value, '%Y-%m-%d').strftime('%b %d, %Y')
    except Exception:
        return "Invalid date"

def get_last_session(service, client_email):
    """Get the last session for a client based on attendee emails."""
    try:
        now = datetime.utcnow().isoformat() + 'Z'
        ninety_days_ago = (datetime.utcnow() - timedelta(days=90)).isoformat() + 'Z'
        user_email = 'adam@mocharymethod.com'
        all_events = []
        page_token = None
        while True:
            events_result = service.events().list(
                calendarId=CALENDAR_ID,
                timeMin=ninety_days_ago,
                timeMax=now,
                maxResults=250,
                singleEvents=True,
                orderBy='startTime',
                pageToken=page_token
            ).execute()
            events = events_result.get('items', [])
            all_events.extend(events)
            page_token = events_result.get('nextPageToken')
            if not page_token:
                break
        # Find all events with both emails
        matching_events = []
        for event in all_events:
            attendees = set(a['email'] for a in event.get('attendees', []) if 'email' in a)
            if user_email in attendees and client_email in attendees:
                # Exclude group meetings with matt
                if 'matt@mocharymethod.com' in attendees:
                    continue
                # Get the start date string (datetime or date)
                start = event['start'].get('dateTime') or event['start'].get('date')
                matching_events.append({
                    'date': start,
                    'summary': event.get('summary', '')
                })
        if not matching_events:
            return None
        # Sort by date descending and return the most recent
        matching_events.sort(key=lambda e: e['date'], reverse=True)
        return matching_events[0]
    except Exception as e:
        print(f"[ERROR] get_last_session for {client_email}: {e}")
        return None

def get_next_session(service, client_email):
    """Get the next session for a client based on attendee emails."""
    try:
        now = datetime.utcnow().isoformat() + 'Z'
        three_months_from_now = (datetime.utcnow() + timedelta(days=90)).isoformat() + 'Z'
        user_email = 'adam@mocharymethod.com'
        all_events = []
        page_token = None

        while True:
            events_result = service.events().list(
                calendarId=CALENDAR_ID,
                timeMin=now,
                timeMax=three_months_from_now,
                maxResults=250,
                singleEvents=True,
                orderBy='startTime',
                pageToken=page_token
            ).execute()

            events = events_result.get('items', [])
            all_events.extend(events)

            page_token = events_result.get('nextPageToken')
            if not page_token:
                break
        
        for event in all_events:
            attendees = event.get('attendees', [])
            if not attendees:
                continue
            
            attendee_emails = {a.get('email', '').lower() for a in attendees}
            
            if user_email in attendee_emails and client_email.lower() in attendee_emails:
                if 'matt@mocharymethod.com' not in attendee_emails:
                    start_str = event['start'].get('dateTime', event['start'].get('date'))
                    return {
                        'date': start_str,
                        'summary': event.get('summary', 'No Title')
                    }
        
        return None
    except Exception as e:
        print(f"Error in get_next_session for {client_email}: {e}")
        return None

if __name__ == '__main__':
    app.run(debug=True, port=5001)