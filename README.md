# Risk Management Application

A comprehensive Risk Management Dashboard built with Django and modern web technologies.

## Features

- **Dashboard** with KPI cards showing key risk metrics
- **Risk Matrix** (5×5) interactive heatmap with click-to-filter
- **Charts** showing risk distribution by category, status, owner, and control effectiveness
- **Risk Register** table with search, filtering, sorting, and pagination
- **Mitigation Checklist** to track risk mitigation status
- **Google Sheets Integration** for data synchronization (optional)
- **Dark Theme** with sea-green accents

## Tech Stack

- **Backend**: Django 5.x + Django REST Framework
- **Frontend**: HTML5, Tailwind CSS, Vanilla JavaScript
- **Charts**: Chart.js
- **Database**: SQLite (default), can be configured for PostgreSQL

## Quick Start

### 1. Install Dependencies

```bash
cd risk_management
pip install -r requirements.txt
```

### 2. Run Database Migrations

```bash
python manage.py migrate
```

### 3. Load Data from CSV

Start the server and then sync the CSV data:

```bash
python manage.py runserver
```

Then visit `http://localhost:8000` and click "Sync CSV" button.

Alternatively, you can load data via management command (if needed):

```bash
python manage.py shell
>>> from risks.services.csv_service import CSVService
>>> CSVService().load_risks_from_csv()
```

### 4. Access the Dashboard

Open your browser and navigate to:

```
http://localhost:8000
```

## Project Structure

```
risk_management/
├── manage.py                 # Django management script
├── requirements.txt          # Python dependencies
├── .env                      # Environment configuration
├── risk_management/          # Django project settings
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── risks/                    # Main Django app
│   ├── models.py            # Risk model
│   ├── views.py             # Template views
│   ├── urls.py              # App URLs
│   ├── admin.py             # Django admin config
│   ├── api/                 # REST API
│   │   ├── views.py         # API endpoints
│   │   ├── serializers.py   # DRF serializers
│   │   └── urls.py          # API URLs
│   └── services/            # Business logic
│       ├── csv_service.py   # CSV operations
│       └── google_sheets.py # Google Sheets integration
├── static/
│   ├── css/
│   │   └── styles.css       # Custom styles
│   └── js/
│       ├── main.js          # Core functionality
│       ├── charts.js        # Chart configurations
│       └── risk-matrix.js   # Risk Matrix component
└── templates/
    ├── base.html            # Base template
    └── dashboard.html       # Main dashboard
```

## API Endpoints

| Endpoint                            | Method | Description                     |
| ----------------------------------- | ------ | ------------------------------- |
| `/api/risks/`                       | GET    | List all risks (with filtering) |
| `/api/risks/<id>/`                  | GET    | Get single risk                 |
| `/api/risks/<id>/toggle-mitigated/` | POST   | Toggle mitigation status        |
| `/api/stats/`                       | GET    | Dashboard statistics            |
| `/api/stats/matrix/`                | GET    | Risk matrix data                |
| `/api/stats/categories/`            | GET    | Risks by category               |
| `/api/stats/status/`                | GET    | Risks by status                 |
| `/api/stats/owners/`                | GET    | Risks by owner                  |
| `/api/sync/csv/`                    | POST   | Sync from CSV file              |
| `/api/sync/sheets/`                 | POST   | Sync from Google Sheets         |

## Filtering Options

The Risk Register supports the following filters:

- **Status**: Open, Mitigated, Closed, Accepted
- **Category**: Access Control, Business Continuity, Configuration, Data Protection, Third-party
- **Owner**: Compliance, Finance, IT, Operations, Security
- **Mitigation Status**: Mitigated / Not Mitigated
- **Search**: Search by Risk ID or Title
- **Risk Matrix**: Click on matrix cells to filter by specific likelihood/impact

## Google Sheets Setup (Optional)

To enable Google Sheets integration:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable the **Google Sheets API**
4. Create a **Service Account** and download the JSON credentials
5. Share your Google Sheet with the service account email
6. Update `.env` file:
   ```
   GOOGLE_SHEETS_CREDENTIALS_FILE=/path/to/credentials.json
   GOOGLE_SHEET_ID=your-sheet-id
   ```

## Customization

### Changing the Theme

Edit the Tailwind configuration in `templates/base.html`:

```javascript
tailwind.config = {
  theme: {
    extend: {
      colors: {
        "sea-green": {
          // Modify colors here
        },
      },
    },
  },
};
```

### Adding Risk Categories

Update the choices in `risks/models.py`:

```python
CATEGORY_CHOICES = [
    ('Access Control', 'Access Control'),
    # Add new categories here
]
```
