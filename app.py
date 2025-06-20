import os
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
from flask_session import Session
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from datetime import datetime, timedelta, timezone
import json
import secrets
from config import SUPABASE_URL, SUPABASE_KEY, SUPABASE_TABLE, CALENDAR_ID
from supabase import create_client, Client
from cachelib import SimpleCache
import pytz

app = Flask(__name__)
app.secret_key = secrets.token_hex(16)
app.config['SESSION_TYPE'] = 'filesystem'
Session(app)

# Initialize cache
cache = SimpleCache()

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Google OAuth configuration
SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']
CLIENT_SECRETS_FILE = "client_secret_100442766788-a19uma1jtb4dda8ab5nkan3erqcena1g.apps.googleusercontent.com.json"

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
    
    clients = get_clients_from_supabase()

    def sort_key(client):
        dt = parse_datetime(client.get('next_session'))
        if dt is None:
            return (0, client.get('name', '').lower())
        return (1, dt)

    clients.sort(key=sort_key)

    now = datetime.now(pytz.utc)

    total_sessions_sum = 0
    sessions_this_month = 0
    
    for client in clients:
        client['needs_scheduling'] = not client.get('next_session')
        total_sessions_sum += client.get('session_count') or 0
        
        last_session_str = client.get('last_session')
        if last_session_str:
            last_session_dt = parse_datetime(last_session_str)
            if last_session_dt and last_session_dt.year == now.year and last_session_dt.month == now.month:
                sessions_this_month += 1

    return render_template('dashboard.html', clients=clients, total_sessions_sum=total_sessions_sum, sessions_this_month=sessions_this_month)

@app.route('/login')
def login():
    """Google OAuth login"""
    flow = Flow.from_client_secrets_file(
        CLIENT_SECRETS_FILE,
        scopes=SCOPES,
        redirect_uri=url_for('oauth2callback', _external=True)
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
    session['credentials'] = credentials_to_dict(credentials)
    
    return redirect(url_for('index'))

def credentials_to_dict(credentials):
    return {'token': credentials.token,
            'refresh_token': credentials.refresh_token,
            'token_uri': credentials.token_uri,
            'client_id': credentials.client_id,
            'client_secret': credentials.client_secret,
            'scopes': credentials.scopes}

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

@app.route('/clients/<client_id>')
def client_detail(client_id):
    """Client detail page"""
    if 'credentials' not in session:
        return redirect(url_for('login'))
    
    try:
        response = supabase.table(SUPABASE_TABLE).select("*").eq('id', client_id).single().execute()
        client = response.data
    except Exception as e:
        print(f"Error fetching client from Supabase: {e}")
        client = None

    if not client:
        flash("Client not found.", "error")
        return redirect(url_for('index'))

    return render_template('client_detail.html', client=client)

@app.route('/clients/<client_id>/edit', methods=['GET', 'POST'])
def edit_client(client_id):
    """Edit client page"""
    if 'credentials' not in session:
        return redirect(url_for('login'))

    if request.method == 'POST':
        try:
            # Create a mutable copy of the form data
            form_data = request.form.to_dict()
            update_data = {}
            for key, value in form_data.items():
                if value == '':
                    update_data[key] = None
                else:
                    update_data[key] = value

            # Update the record in Supabase
            response = supabase.table(SUPABASE_TABLE).update(update_data).eq('id', client_id).execute()

            if response.data:
                flash('Client updated successfully!', 'success')
                return redirect(url_for('client_detail', client_id=client_id))
            else:
                 flash('Error updating client.', 'error')

        except Exception as e:
            flash(f"An error occurred: {e}", "error")

    try:
        response = supabase.table(SUPABASE_TABLE).select("*").eq('id', client_id).single().execute()
        client = response.data
    except Exception as e:
        print(f"Error fetching client from Supabase: {e}")
        client = None

    if not client:
        flash("Client not found.", "error")
        return redirect(url_for('index'))

    return render_template('edit_client.html', client=client)

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

@app.route('/sync')
def sync_sessions():
    """
    Manual trigger to sync Google Calendar events to Supabase.
    """
    if 'credentials' not in session:
        return redirect(url_for('login'))

    service = get_google_calendar_service()
    if not service:
        flash("Could not get Google Calendar service.", "error")
        return redirect(url_for('index'))

    try:
        sync_client_data(service)
        flash("Successfully synced with Google Calendar.", "success")
    except Exception as e:
        flash(f"An error occurred during sync: {e}", "error")

    return redirect(url_for('index'))

def sync_client_data(service):
    """
    Fetches events from Google Calendar and updates client records in Supabase
    with the last session, next session, and total session count.
    """
    clients = get_clients_from_supabase()
    user_email = 'adam@mocharymethod.com'

    for client in clients:
        client_email = client.get('email')
        if not client_email:
            continue

        now = datetime.now(pytz.utc).isoformat()
        one_year_ago = (datetime.now(pytz.utc) - timedelta(days=365)).isoformat()
        one_year_later = (datetime.now(pytz.utc) + timedelta(days=365)).isoformat()

        all_events = []
        page_token = None
        while True:
            events_result = service.events().list(
                calendarId=CALENDAR_ID,
                timeMin=one_year_ago,
                timeMax=one_year_later,
                maxResults=250,
                singleEvents=True,
                orderBy='startTime',
                pageToken=page_token,
                q=client_email  # Search for events with the client's email
            ).execute()
            events = events_result.get('items', [])
            all_events.extend(events)
            page_token = events_result.get('nextPageToken')
            if not page_token:
                break

        # Filter events to ensure the client is an attendee
        client_events = [
            event for event in all_events
            if any(att.get('email') == client_email for att in event.get('attendees', []))
            and any(att.get('email') == user_email for att in event.get('attendees', []))
        ]

        # Filter events that have a start date/datetime
        valid_events = [e for e in client_events if get_event_start_iso(e)]

        # Separate past and future sessions
        past_sessions = [
            e for e in valid_events
            if get_event_start_iso(e) < now
        ]
        future_sessions = [
            e for e in valid_events
            if get_event_start_iso(e) >= now
        ]
        
        # Sort sessions by date
        past_sessions.sort(key=get_event_start_iso)
        future_sessions.sort(key=get_event_start_iso)

        last_session_iso = get_event_start_iso(past_sessions[-1] if past_sessions else None)
        next_session_iso = get_event_start_iso(future_sessions[0] if future_sessions else None)
        
        last_session_date = parse_datetime(last_session_iso) if last_session_iso else None
        next_session_date = parse_datetime(next_session_iso) if next_session_iso else None

        update_data = {
            'last_session': last_session_date.isoformat() if last_session_date else None,
            'next_session': next_session_date.isoformat() if next_session_date else None,
            'total_sessions': len(valid_events)
        }

        # Update the record in Supabase
        supabase.table(SUPABASE_TABLE).update(update_data).eq('id', client['id']).execute()

@app.template_filter('format_date')
def format_date(value):
    if not value:
        return "None"
    try:
        dt = parse_datetime(value)
        if dt:
            return dt.strftime('%b %d, %Y')
        return "Invalid date"
    except Exception:
        return "Invalid date"

def get_google_calendar_service():
    """Get Google Calendar service if user is authenticated"""
    if 'credentials' not in session:
        return None
    
    credentials = Credentials(**session['credentials'])
    return build('calendar', 'v3', credentials=credentials)

def parse_datetime(datetime_str):
    """Parses a datetime string from Google Calendar API into a datetime object."""
    try:
        # Handles both date ('YYYY-MM-DD') and datetime strings
        return datetime.fromisoformat(datetime_str.replace('Z', '+00:00'))
    except (ValueError, TypeError):
        return None

def get_event_start_iso(event):
    """Returns the start datetime as an ISO string for a Google Calendar event."""
    if not event:
        return None
    start = event.get('start', {})
    # Return dateTime if available, otherwise date.
    return start.get('dateTime') or start.get('date')

if __name__ == '__main__':
    app.run(debug=True, port=5004)