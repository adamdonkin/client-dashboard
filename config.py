# Configuration file for your coaching dashboard

# Supabase Configuration
SUPABASE_URL = "https://bhiwuvjltwvdkhcnwkkt.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoaXd1dmpsdHd2ZGtoY253a2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAyNzQ4ODAsImV4cCI6MjA2NTg1MDg4MH0.GpzLOZTvdsWp2eGVKzS3QrS68gF5IQDKOV1iAV-6m8A"
SUPABASE_TABLE = "clients"

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