import os
from datetime import datetime
from flask import Flask, jsonify

app = Flask(__name__)
PORT = int(os.environ.get('PORT', 3000))

def check_database():
    """Check database connection"""
    database_url = os.environ.get('DATABASE_URL')
    
    try:
        import psycopg2
        
        # If DATABASE_URL is set, use it
        if database_url:
            from urllib.parse import urlparse
            # Parse DATABASE_URL (format: postgresql://user:password@host:port/database)
            parsed = urlparse(database_url)
            
            conn = psycopg2.connect(
                host=parsed.hostname or os.environ.get('DATABASE_HOST', 'postgres'),
                port=parsed.port or int(os.environ.get('DATABASE_PORT', 5432)),
                database=parsed.path[1:] if parsed.path else os.environ.get('DATABASE_NAME', 'postgres'),
                user=parsed.username or os.environ.get('DATABASE_USER', 'pgadmin'),
                password=parsed.password or os.environ.get('DATABASE_PASSWORD', 'admin123')
            )
        else:
            # Fallback to individual environment variables
            conn = psycopg2.connect(
                host=os.environ.get('DATABASE_HOST', os.environ.get('DB_HOST', 'postgres')),
                port=int(os.environ.get('DATABASE_PORT', os.environ.get('DB_PORT', 5432))),
                database=os.environ.get('DATABASE_NAME', os.environ.get('DB_NAME', 'postgres')),
                user=os.environ.get('DATABASE_USER', os.environ.get('DB_USER', 'pgadmin')),
                password=os.environ.get('DATABASE_PASSWORD', os.environ.get('DB_PASSWORD', 'admin123'))
            )
        
        conn.close()
        return True
    except ImportError:
        return 'psycopg2 not installed'
    except Exception as e:
        return str(e)

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint with database connectivity check"""
    health_status = {
        'status': 'ok',
        'timestamp': datetime.utcnow().isoformat() + 'Z'
    }
    
    # Check database connection if database is configured (DATABASE_URL or individual vars)
    database_url = os.environ.get('DATABASE_URL')
    database_host = os.environ.get('DATABASE_HOST') or os.environ.get('DB_HOST')
    database_name = os.environ.get('DATABASE_NAME') or os.environ.get('DB_NAME')
    
    # Only check database if database is configured
    if database_url or database_host or database_name:
        db_check = check_database()
        if db_check is True:
            health_status['database'] = 'connected'
        else:
            health_status['database'] = 'error'
            health_status['database_error'] = str(db_check)
            return jsonify(health_status), 503
    
    return jsonify(health_status), 200

@app.route('/', methods=['GET'])
def root():
    """Root endpoint"""
    return jsonify({
        'message': 'AI Fabrix Application',
        'version': '1.0.0'
    }), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=PORT, debug=False)

