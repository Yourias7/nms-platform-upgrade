# NMS Platform Upgrade

A modern, full-stack Network Management System (NMS) web application built with FastAPI and vanilla JavaScript. This platform provides real-time monitoring and visualization of telecommunication system telemetry data, including location tracking, signal strength metrics (RSRP/SINR), temperature monitoring, and directional information.

## 🌟 Features

### Dashboard & Visualization
- **Interactive Dashboard**: Real-time view of all registered systems with visual status indicators
- **World Map Visualization**: Leaflet-based interactive map with custom markers showing system locations
- **Multi-Select Support**: Select and compare multiple systems simultaneously
- **Serial Number Filtering**: Real-time search and filter with debounced input
- **Detailed Telemetry View**: Comprehensive measurement data display for selected systems

### Data Management
- **Dual Data Source Support**: Seamlessly works with both MySQL/MariaDB database and Excel files
- **CSV Export**: Export system records for offline analysis
- **Auto-Refresh**: Configurable periodic data updates (default: 30 seconds)
- **Data Caching**: Optimized data loading with smart caching strategies

### User Interface
- **Multi-Tab Navigation**: Dashboard, Alarms, and Settings tabs
- **Responsive Design**: Mobile-friendly Bootstrap 5 interface
- **Animated UI**: Smooth glassmorphism effects with glowing orbs
- **Dark Theme**: Modern dark mode design with purple accent colors

### Monitoring & Alerts
- **Alarms System**: Track and display system alarms with configurable thresholds
- **Temperature Monitoring**: Visual alerts for temperature thresholds
- **Signal Quality Tracking**: RSRP and SINR monitoring with customizable limits

## 🛠 Tech Stack

### Backend
- **FastAPI** (0.100+): Modern, high-performance Python web framework with automatic API documentation
- **SQLAlchemy** (2.0+): SQL toolkit and Object-Relational Mapping (ORM)
- **PyMySQL**: Pure Python MySQL/MariaDB database connector
- **Pandas & OpenPyxl**: Excel file processing and data manipulation
- **Uvicorn**: Lightning-fast ASGI server
- **Jinja2**: Template engine for HTML rendering

### Frontend
- **Vanilla JavaScript (ES6+)**: Modular architecture with ES6 imports
- **Bootstrap 5.3**: Responsive UI framework
- **Leaflet 1.9**: Interactive map library
- **HTML2Canvas**: Screenshot/image capture functionality
- **JSZip**: Client-side ZIP file generation

### Database
- **MySQL/MariaDB**: Primary data storage
- **Excel (.xlsx)**: Alternative data source for development/testing

## 📁 Project Structure

```
NMS Upgrade/
├── app/                    # Application package
│   ├── __init__.py        # Package initializer
│   ├── main.py            # FastAPI application entry point & API routes
│   ├── models.py          # SQLAlchemy ORM models (Measurement table)
│   ├── database.py        # Database connection & session management
│   ├── deps.py            # FastAPI dependency injection (DB sessions)
│   └── data_source.py     # Excel data source adapter
├── static/
│   ├── css/
│   │   ├── style.css      # Main application styles (glassmorphism theme)
│   │   └── home.css       # Home page specific styles
│   ├── img/
│   │   ├── favicon.ico    # Browser favicon
│   │   ├── favicon-*.png  # PNG favicon variants
│   │   ├── apple-touch-icon.png  # iOS home screen icon
│   │   └── New folder/
│   │       └── Picture1.png  # Logo/brand assets
│   └── js/
│       ├── app.js         # Main application orchestrator
│       ├── api.js         # API communication layer
│       ├── config.js      # Configuration constants & settings
│       ├── details.js     # Details panel rendering logic
│       ├── map.js         # Leaflet map initialization & controls
│       ├── serials.js     # Serial list management & filtering
│       ├── settings.js    # Settings tab functionality
│       ├── alarms.js      # Alarms monitoring & display
│       └── utils.js       # Shared utility functions (debounce, tabs, etc.)
├── templates/
│   ├── dashboard.html     # Main dashboard UI
│   └── home.html          # Landing page
├── scripts/
│   └── create_sample_png.py  # Utility script for generating sample images
├── data.xlsx              # Excel data file (data source)
├── requirements.txt       # Python package dependencies
├── .env                   # Environment variables (not in git)
├── .env.example           # Environment variables template
├── .gitignore             # Git ignore rules
├── GIT_WORKFLOW.md        # Git workflow guide
└── README.md              # Project documentation (this file)
```

## 🚀 Quick Start

### Prerequisites
- **Python 3.8+** (3.10+ recommended)
- **MySQL/MariaDB** (optional, if not using Excel mode)
- **Modern web browser** (Chrome, Firefox, Edge, Safari)
- **pip** package manager

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd "NMS Upgrade"
   ```

2. **Create and activate virtual environment**
   ```powershell
   # Create virtual environment
   python -m venv venv
   
   # Activate (Windows PowerShell)
   venv\Scripts\Activate.ps1
   
   # Activate (Windows CMD)
   venv\Scripts\activate.bat
   
   # Activate (macOS/Linux)
   source venv/bin/activate
   ```

3. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure Environment Variables**
   ```bash
   # Copy the example environment file
   cp .env.example .env
   
   # Edit .env with your database credentials
   # On Windows, you can use: copy .env.example .env
   ```
   
   Update the [.env](.env) file with your actual database credentials:
   ```env
   DB_HOST=your-database-host
   DB_NAME=your-database-name
   DB_USER=your-username
   DB_PASS=your-password
   DB_PORT=3306
   ```

5. **Configure Data Source**

   **Option A: Excel File Mode (Recommended for Development)**
   - Place your `data.xlsx` file in the project root directory
   - Required columns: `SERIAL`, `LATITUDE`, `LONGITUDE`, `DATETIME`, `AZIMUTH`, `RSRP`, `SINR`, `TEMP`
   - The system will automatically detect and use the Excel file if present

   **Option B: MySQL/MariaDB Mode (Production)**
   - Ensure your database credentials are configured in [.env](.env)
   - Ensure the `Systems` table exists (see [app/models.py](app/models.py) for schema)
   - If no `data.xlsx` file exists, the system will use database automatically

6. **Run the Application**
   ```bash
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
   ```
   
   For production deployment:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8001 --workers 4
   ```

6. **Access the Application**
   - **Local**: `http://127.0.0.1:8001`
   - **Dashboard**: `http://127.0.0.1:8001/dashboard`
   - **API Docs**: `http://127.0.0.1:8001/docs` (Swagger UI)
   - **Alternative API Docs**: `http://127.0.0.1:8001/redoc`

## 📡 API Reference

### REST Endpoints

#### Home & UI
- `GET /` → Landing page
- `GET /dashboard` → Main dashboard interface

#### System Data
- `GET /systems/serials` → List all unique serial numbers
  ```json
  ["SERIAL001", "SERIAL002", "SERIAL003"]
  ```

- `GET /Systems/{serial}` → Get all measurements for a specific serial
  ```json
  [
    {
      "id": 1,
      "SERIAL": "ABC123",
      "LATITUDE": 40.7128,
      "LONGITUDE": -74.0060,
      "DATETIME": "2025-12-12T10:30:00",
      "AZIMUTH": 180.5,
      "RSRP": -85.2,
      "SINR": 12.5,
      "TEMP": 25.3
    }
  ]
  ```

- `GET /systems/locations` → Get latest GPS coordinates for all serials
  ```json
  [
    {
      "serial": "ABC123",
      "latitude": 40.7128,
      "longitude": -74.0060
    }
  ]
  ```

- `GET /export/{serial}` → Download CSV file with all measurements for a serial
  - Returns: `application/csv` file attachment

### Data Model

The `Measurement` model ([models.py](models.py)) represents telemetry data:

| Field | Type | Description |
|-------|------|-------------|
| `id` | Integer | Primary key (auto-increment) |
| `SERIAL` | String | Unique system identifier |
| `LATITUDE` | Float | GPS latitude coordinate |
| `LONGITUDE` | Float | GPS longitude coordinate |
| `DATETIME` | DateTime | Timestamp of measurement |
| `AZIMUTH` | Float | Directional bearing (0-360°) |
| `RSRP` | Float | Reference Signal Received Power (dBm) |
| `SINR` | Float | Signal-to-Interference-plus-Noise Ratio (dB) |
| `TEMP` | Float | Temperature reading (°C) |

## ⚙️ Configuration

### Frontend Settings ([static/js/config.js](static/js/config.js))
```javascript
export const CONFIG = {
  API_BASE_URL: '',  // API endpoint base
  REFRESH_INTERVAL: 30000,  // Auto-refresh (ms)
  DEBOUNCE_DELAY: 300,  // Filter debounce (ms)
  
  MAP: {
    DEFAULT_CENTER: [20, 0],  // Initial map center
    DEFAULT_ZOOM: 2,  // Initial zoom level
    MAX_ZOOM: 18,
    MIN_ZOOM: 2
  },
  
  // Alarm thresholds
  ALARMS: {
    RSRP_THRESHOLD: -100,
    SINR_THRESHOLD: 0,
    TEMP_THRESHOLD: 70
  }
};
```

### Backend Settings

**Database Configuration** ([database.py](database.py)):
```python
DB_HOST = "mysql-yourias.alwaysdata.net"
DB_NAME = "yourias_db"
DB_USER = "yourias"
DB_PASS = "uhora$#20"
DB_PORT = 3306
```

**Excel Data Source** ([data_source.py](data_source.py)):
- File location: `./data.xlsx` (project root)
- Automatic fallback to database if Excel file doesn't exist
- Pandas + OpenPyXL for reading Excel files

## 🎯 Key Features Explained

### Dashboard Interface
The main dashboard ([dashboard.html](templates/dashboard.html)) consists of three panels:

1. **Serials Panel (Left)**
   - Displays all system serial numbers
   - Real-time filter/search functionality
   - Visual status indicators (LED lights)
   - Multi-select support
   - Click to select/deselect systems

2. **Map Panel (Center)**
   - Interactive Leaflet world map
   - Custom markers for each system
   - Displays selected system(s) locations
   - Automatic zoom/pan to fit selected markers
   - Click markers for system info

3. **Details Panel (Right)**
   - Comprehensive measurement data table
   - Displays data for all selected systems
   - CSV export button per system
   - Scrollable data view
   - Real-time updates

### Status Indicators
- 🟢 **Green LED**: System active with recent data
- 🔴 **Red LED**: System offline or no recent telemetry
- LED logic can be customized in [serials.js](static/js/serials.js)

### Multi-Select Functionality
- Select multiple systems to compare data
- Map shows all selected systems
- Details panel aggregates data from all selections
- Selection persists during auto-refresh
- Visual feedback with highlighted cards

### Alarms System
- Monitor RSRP, SINR, and temperature thresholds
- Configurable alert levels
- Visual notifications in UI
- Extensible for custom alarm rules

### Data Export
- Export individual system data as CSV
- Includes all measurement records
- Filename format: `{SERIAL}.csv`
- Compatible with Excel, Google Sheets, etc.

## 🏗️ Architecture

### Backend Flow
```
Client Request → FastAPI Router (main.py)
                    ↓
              Dependency Injection (deps.py)
                    ↓
         Data Source Check (has_excel?)
                    ↓
    ┌───────────────┴───────────────┐
    ↓                               ↓
Excel Source                  Database Source
(data_source.py)              (database.py + models.py)
    ↓                               ↓
Pandas DataFrame              SQLAlchemy ORM
    ↓                               ↓
    └───────────────┬───────────────┘
                    ↓
            JSON Response → Client
```

### Frontend Architecture
```
dashboard.html
      ↓
   app.js (Orchestrator)
      ↓
  ┌───┴───────────────┬─────────────┬──────────┐
  ↓                   ↓             ↓          ↓
api.js          serials.js      map.js    details.js
  ↓                   ↓             ↓          ↓
  └──────────┬────────┴──────┬──────┴──────────┘
             ↓               ↓
         utils.js      config.js
```

**Module Responsibilities:**
- **app.js**: Main controller, coordinates all modules, handles events
- **api.js**: Centralized HTTP requests to backend API
- **serials.js**: Serial list state management, filtering, rendering
- **map.js**: Leaflet map initialization, marker management
- **details.js**: Details panel rendering, CSV export
- **alarms.js**: Alarm monitoring and notifications
- **settings.js**: User preferences and configuration
- **utils.js**: Shared utilities (debounce, date parsing, tabs)
- **config.js**: Application-wide constants

## 🔧 Development Guide

### Adding New API Endpoints

1. **Define route in [main.py](main.py)**:
```python
@app.get("/systems/statistics")
def get_statistics(db: Session = Depends(get_db)):
    # Your logic here
    return {"total_systems": 100, "active": 85}
```

2. **Add API method in [static/js/api.js](static/js/api.js)**:
```javascript
export async function fetchStatistics() {
  const response = await fetch('/systems/statistics');
  return response.json();
}
```

3. **Use in frontend module**:
```javascript
import { fetchStatistics } from './api.js';

const stats = await fetchStatistics();
console.log(stats);
```

### Adding Database Models

1. **Update [models.py](models.py)**:
```python
class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True)
    serial = Column(String(255))
    message = Column(String(500))
    timestamp = Column(DateTime)
```

2. **Create migration** (if using Alembic):
```bash
alembic revision --autogenerate -m "Add alerts table"
alembic upgrade head
```

### Styling Guidelines
- Base styles in [static/css/style.css](static/css/style.css)
- Uses CSS custom properties (variables) for theming
- Glassmorphism design with `backdrop-filter`
- Bootstrap 5 utilities for responsive layout
- Dark theme with purple accent colors

### Code Style
- **Python**: PEP 8 compliant, type hints recommended
- **JavaScript**: ES6+, camelCase, JSDoc comments
- **HTML**: Semantic tags, proper indentation
- **CSS**: BEM naming convention where applicable

## 🐛 Troubleshooting

### Application Won't Start
- **Check Python version**: `python --version` (must be 3.8+)
- **Verify dependencies**: `pip list` (compare with requirements.txt)
- **Port conflict**: Ensure port 8001 is available
  ```powershell
  netstat -ano | findstr :8001
  ```
- **Virtual environment**: Confirm it's activated (check prompt prefix)

### Database Connection Errors
- **MySQL Connection Failed**:
  - Verify database credentials in [database.py](database.py)
  - Check database server is running
  - Test connection: `mysql -h HOST -u USER -p`
  - Verify firewall allows MySQL port (3306)
- **Table doesn't exist**:
  - Run database migrations or create table manually
  - Check table name matches model (case-sensitive)

### Excel File Issues
- **File not found**: Place `data.xlsx` in project root directory
- **Column errors**: Ensure all required columns exist with exact names (case-sensitive)
- **DateTime parsing**: Verify dates are in recognizable format (ISO 8601 recommended)
- **Install pandas**: `pip install pandas openpyxl`

### Frontend Issues
- **Map not loading**: Check Leaflet CDN connectivity
- **API errors**: Open browser DevTools (F12) → Console tab
- **Blank page**: Check browser console for JavaScript errors
- **CORS errors**: Ensure backend CORS settings allow frontend origin

### No Data Displaying
- Check data source (Excel or database) contains records
- Verify serial numbers are strings, not empty
- Check API endpoint returns data: `http://127.0.0.1:8001/systems/serials`
- Inspect browser Network tab (F12) for failed requests

## 📊 Data Requirements

### Excel File Format
Your `data.xlsx` must include these columns (case-sensitive):

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| SERIAL | String | Yes | Unique system identifier |
| LATITUDE | Float | Yes | GPS latitude (-90 to 90) |
| LONGITUDE | Float | Yes | GPS longitude (-180 to 180) |
| DATETIME | DateTime | Yes | Measurement timestamp |
| AZIMUTH | Float | No | Direction bearing (0-360°) |
| RSRP | Float | No | Signal power (dBm) |
| SINR | Float | No | Signal quality (dB) |
| TEMP | Float | No | Temperature (°C) |

**Example Excel Data:**
```
SERIAL    LATITUDE  LONGITUDE  DATETIME             AZIMUTH  RSRP    SINR  TEMP
ABC123    40.7128   -74.0060   2025-01-15 10:30:00  180.5    -85.2   12.5  25.3
DEF456    34.0522   -118.2437  2025-01-15 10:31:00  90.0     -92.1   8.3   28.7
```

### Database Schema
The MySQL/MariaDB `Systems` table should match the model in [models.py](models.py):

```sql
CREATE TABLE Systems (
    id INT AUTO_INCREMENT PRIMARY KEY,
    SERIAL VARCHAR(255) UNIQUE,
    LATITUDE FLOAT,
    LONGITUDE FLOAT,
    DATETIME DATETIME,
    AZIMUTH FLOAT,
    RSRP FLOAT,
    SINR FLOAT,
    TEMP FLOAT,
    INDEX idx_serial (SERIAL)
);
```

## 🔐 Security Considerations

⚠️ **Important**: The current [database.py](database.py) contains hardcoded credentials. For production:

1. **Use Environment Variables**:
   ```python
   import os
   from dotenv import load_dotenv
   
   load_dotenv()
   DB_HOST = os.getenv("DB_HOST")
   DB_USER = os.getenv("DB_USER")
   DB_PASS = os.getenv("DB_PASS")
   ```

2. **Create `.env` file** (add to `.gitignore`):
   ```env
   DB_HOST=your-host
   DB_NAME=your-database
   DB_USER=your-username
   DB_PASS=your-password
   ```

3. **Other Security Best Practices**:
   - Enable HTTPS in production
   - Implement authentication/authorization
   - Use API rate limiting
   - Sanitize user inputs
   - Keep dependencies updated
   - Set secure CORS policies

## 🚢 Deployment

### Production Deployment

1. **Update Configuration**:
   - Remove `--reload` flag from uvicorn
   - Use production database
   - Set proper CORS origins
   - Enable HTTPS

2. **Run with Gunicorn + Uvicorn Workers**:
   ```bash
   gunicorn main:app \
     --workers 4 \
     --worker-class uvicorn.workers.UvicornWorker \
     --bind 0.0.0.0:8001 \
     --timeout 120
   ```

3. **Use Process Manager** (systemd, supervisor, or PM2):
   ```ini
   # /etc/systemd/system/nms.service
   [Unit]
   Description=NMS Platform
   After=network.target
   
   [Service]
   Type=notify
   User=www-data
   WorkingDirectory=/path/to/nms
   ExecStart=/path/to/venv/bin/gunicorn main:app \
     --workers 4 \
     --worker-class uvicorn.workers.UvicornWorker \
     --bind 0.0.0.0:8001
   Restart=always
   
   [Install]
   WantedBy=multi-user.target
   ```

4. **Reverse Proxy** (Nginx):
   ```nginx
   server {
       listen 80;
       server_name nms.example.com;
       
       location / {
           proxy_pass http://127.0.0.1:8001;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       }
       
       location /static {
           alias /path/to/nms/static;
       }
   }
   ```

### Docker Deployment (Optional)

Create `Dockerfile`:
```dockerfile
FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
```

Create `docker-compose.yml`:
```yaml
version: '3.8'
services:
  nms:
    build: .
    ports:
      - "8001:8001"
    environment:
      - DB_HOST=mysql
      - DB_NAME=nms_db
      - DB_USER=nms_user
      - DB_PASS=secret
    depends_on:
      - mysql
  
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: rootpass
      MYSQL_DATABASE: nms_db
      MYSQL_USER: nms_user
      MYSQL_PASSWORD: secret
    volumes:
      - mysql_data:/var/lib/mysql

volumes:
  mysql_data:
```

Run with: `docker-compose up -d`

## 📈 Performance Optimization

### Backend Optimization
- **Database Connection Pooling**: Already configured in [database.py](database.py)
  ```python
  pool_size=10,
  max_overflow=20,
  pool_recycle=1800
  ```
- **Query Optimization**: Add indexes on frequently queried columns
- **Caching**: Implement Redis for frequently accessed data
- **Pagination**: For large datasets, add pagination to API endpoints

### Frontend Optimization
- **Debouncing**: Already implemented for filter input (300ms)
- **Lazy Loading**: Load map markers on demand for large datasets
- **Minimize API Calls**: Batch requests where possible
- **Service Workers**: Cache static assets for offline access

## 🧪 Testing

### Manual Testing Checklist
- [ ] Application starts without errors
- [ ] Dashboard loads successfully
- [ ] Serial list displays correctly
- [ ] Filter/search works
- [ ] Map shows system locations
- [ ] System selection updates map and details
- [ ] CSV export downloads correctly
- [ ] Auto-refresh updates data
- [ ] All tabs navigate properly
- [ ] Alarms display when thresholds exceeded

### API Testing with curl
```powershell
# List all serials
curl http://127.0.0.1:8001/systems/serials

# Get specific serial data
curl http://127.0.0.1:8001/Systems/ABC123

# Get all locations
curl http://127.0.0.1:8001/systems/locations

# Export CSV
curl -o export.csv http://127.0.0.1:8001/export/ABC123
```

## 📚 Learning Resources

### Understanding the Codebase
1. **Start with [main.py](main.py)**: Application entry point and API routes
2. **Review [models.py](models.py)**: Data structure definition
3. **Examine [static/js/app.js](static/js/app.js)**: Frontend orchestration
4. **Study [static/js/config.js](static/js/config.js)**: Configuration options

### Technologies Used
- **FastAPI Documentation**: https://fastapi.tiangolo.com/
- **SQLAlchemy Tutorial**: https://docs.sqlalchemy.org/
- **Leaflet Guide**: https://leafletjs.com/
- **Bootstrap 5 Docs**: https://getbootstrap.com/docs/5.3/
- **ES6 Modules**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules

### Extending the Application
- Add authentication (FastAPI-Users, OAuth2)
- Implement WebSocket for real-time updates
- Add data visualization charts (Chart.js, D3.js)
- Create mobile app (React Native, Flutter)
- Add email/SMS notifications
- Implement historical data analysis

## 🤝 Contributing

To contribute to this project:
1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit for review
5. Document new features in this README

## 📝 License

This project is for internal use. Refer to your organization's policies regarding code usage and distribution.

## 📞 Support

For questions or issues:
- Check the **Troubleshooting** section above
- Review FastAPI logs in terminal
- Check browser console for frontend errors
- Inspect Network tab in DevTools for API issues

## 🔄 Version History

- **v1.0** (Current): Initial release with core features
  - Dashboard with map visualization
  - Dual data source support (Excel/MySQL)
  - Multi-select system comparison
  - CSV export functionality
  - Alarms monitoring
  - Auto-refresh capability

---

**Built with ❤️ for Network Management System monitoring**

*Last Updated: January 2026*

### No data displayed
- **Excel mode**: Verify `data.xlsx` exists and has correct columns
- **Database mode**: Check database connection in `database.py`
- Check browser console for JavaScript errors
- Check uvicorn logs for backend errors

### Map not loading
- Ensure internet connection (uses OpenStreetMap tiles)
- Check browser console for Leaflet errors
- Verify marker icon files exist in `static/img/`

### CSV export not working
- Check that data exists for selected serial
- Verify browser allows file downloads
- Check backend logs for export errors

## Future Enhancements

- **Analytics Tab**: Data visualization, charts, and trend analysis
- **Settings Tab**: User preferences, theme selection, configuration management
- **Real-time Updates**: WebSocket support for live data streaming
- **User Authentication**: Login system and role-based access
- **Advanced Filtering**: Date ranges, signal strength thresholds
- **Alerts/Notifications**: System status change notifications
- **Mobile Responsiveness**: Optimized mobile UI

## 🤝 Contributing & Git Workflow

### Initial Setup for Collaborators

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd "NMS Upgrade"
   ```

2. **Follow the Installation Steps** above to set up your local environment

3. **Create your own .env file** (never commit this!)
   ```bash
   cp .env.example .env
   # Edit .env with your local database credentials
   ```

### Recommended Branch Strategy

We recommend using **Git Flow** or a simplified **Feature Branch Workflow**:

#### Branch Structure:
- `main` - Production-ready code, always stable
- `develop` - Integration branch for features, main development branch
- `feature/<feature-name>` - Individual feature branches
- `bugfix/<bug-name>` - Bug fix branches
- `hotfix/<issue>` - Urgent production fixes

#### Workflow:

1. **Start a new feature**
   ```bash
   # Make sure you're on develop and up to date
   git checkout develop
   git pull origin develop
   
   # Create a new feature branch
   git checkout -b feature/add-user-authentication
   ```

2. **Make your changes and commit**
   ```bash
   git add .
   git commit -m "Add user authentication system"
   ```

3. **Push your branch**
   ```bash
   git push origin feature/add-user-authentication
   ```

4. **Create a Pull Request**
   - Go to your Git hosting platform (GitHub/GitLab/Bitbucket)
   - Create a PR from `feature/add-user-authentication` → `develop`
   - Request code review from team members
   - Address feedback and make changes as needed

5. **After PR is merged**
   ```bash
   git checkout develop
   git pull origin develop
   git branch -d feature/add-user-authentication
   ```

#### Best Practices:
- **Never commit sensitive data**: Database passwords, API keys, etc. (use `.env`)
- **Write descriptive commit messages**: "Add map filtering feature" not "update"
- **Keep branches small and focused**: One feature per branch
- **Pull before you push**: Always `git pull` before starting work
- **Test before committing**: Run the application locally
- **Code review**: At least one team member should review PRs
- **Don't commit to `main` directly**: Always go through `develop` and PRs

### Common Git Commands

```bash
# Check status of your changes
git status

# See what branches exist
git branch -a

# Switch to a different branch
git checkout <branch-name>

# Update your branch with latest changes from develop
git checkout feature/your-feature
git merge develop

# Undo uncommitted changes
git checkout -- <file>

# View commit history
git log --oneline --graph --decorate
```

## License

Proprietary - Internal use only

## Support

For issues or questions, contact the development team.

---

**Version**: 1.0.0  
**Last Updated**: December 2025
