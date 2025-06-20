# Configuration file for your coaching dashboard

import os

# Supabase Configuration
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
SUPABASE_TABLE = os.environ.get("SUPABASE_TABLE", "clients")

# Google Calendar settings
CALENDAR_ID = 'primary'  # Use 'primary' for your main calendar, or a specific calendar ID

# Session settings
SESSION_TIMEOUT = 3600  # Session timeout in seconds (1 hour)

# CRM Fields - these should match your Supabase table columns
CRM_FIELDS = [
    'id',
    'name', 
    'email',
    'phone',
    'status',
    'notes',
    'goals',
    'coaching_package',
    'start_date',
    'last_contact',
    'next_follow_up',
    'source',
    'emergency_contact',
    'created_at',
    'updated_at'
] 