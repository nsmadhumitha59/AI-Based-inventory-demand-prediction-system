# StockWise AI – Inventory Demand Prediction System

A complete, production-quality, full-stack AI-powered Inventory Management System with real-time demand forecasting using Machine Learning.

---

## 🚀 Features

- **AI Demand Forecasting** – Random Forest Regressor (scikit-learn) with chronological holdout validation, transparent baseline fallback for insufficient data
- **Complete Inventory CRUD** – Add, edit, delete products with unique SKU enforcement, stock status tracking, CSV import/export
- **Stock Movement Audit Trail** – Every change logged with type, quantity, reason, timestamp
- **Sales Analytics** – Daily/weekly/monthly trends, category distribution, revenue tracking, channel analysis
- **Supplier Management** – Supplier profiles, product relationships, lead time tracking
- **Reorder Recommendation Engine** – Priority-based recommendations with transparent business rule explanations
- **Reports & CSV Exports** – Inventory summary, sales report, low-stock report
- **JWT Authentication** – Secure login/register with token refresh
- **Premium SaaS Dashboard** – Built with React 19 + TailwindCSS v4, Recharts, Lucide icons
- **10 Backend Tests** – All passing, including chronological time-series validation

---

## 🏗️ Architecture

```
AI-inventory demand prediction/
├── backend/                    # Django 5.2 Backend
│   ├── accounts/               # JWT Auth + User Profiles
│   ├── inventory/              # Products, Categories, StockMovements
│   │   ├── management/
│   │   │   └── commands/
│   │   │       └── seed_sample_data.py  # Data seeder
│   ├── sales/                  # Sales recording with atomic transactions
│   ├── forecasting/            # ML Engine + ForecastRun/Results/Recommendations
│   │   └── ml_engine.py        # Random Forest Regressor + Baseline fallback
│   ├── suppliers/              # Supplier + SupplierProduct management
│   ├── reports/                # Dashboard + Report views
│   └── stockwise/              # Project config, URLs, settings
├── frontend/                   # React 19 + Vite + TailwindCSS v4
│   └── src/
│       ├── api/                # Axios API services (auth, inventory, sales, etc.)
│       ├── components/
│       │   ├── common/         # MetricCard, Modal, Badge, Skeleton, EmptyState, ErrorState
│       │   └── layout/         # Sidebar, Topbar, AppLayout
│       ├── context/            # AuthContext (JWT)
│       └── pages/              # Dashboard, Inventory, Forecast, Sales, Suppliers, Reports, Settings
└── venv/                       # Python virtual environment
```

---

## 🛠️ Technology Stack

| Layer | Technology |
|-------|-----------|
| Backend | Django 5.2 + Django REST Framework |
| Authentication | djangorestframework-simplejwt (JWT) |
| ML/Forecasting | scikit-learn (RandomForestRegressor), pandas, numpy |
| Database | SQLite (dev) — PostgreSQL compatible |
| Frontend | React 19 + Vite 8 |
| Styling | TailwindCSS v4 |
| Charts | Recharts |
| Icons | Lucide React |
| Notifications | React Hot Toast |
| HTTP Client | Axios with JWT interceptors |

---

## ⚙️ Prerequisites

- Python 3.10+
- Node.js 18+
- npm 9+

---

## 🔧 Backend Setup

```powershell
# Navigate to project root
cd "AI-inventory demand prediction"

# Activate virtual environment (already created)
.\venv\Scripts\Activate.ps1

# Navigate to backend
cd backend

# Run migrations
..\venv\Scripts\python manage.py migrate

# Seed sample data (only run once or with --clear to reset)
..\venv\Scripts\python manage.py seed_sample_data

# Optional: Reset and reseed
..\venv\Scripts\python manage.py seed_sample_data --clear
```

---

## 🌐 Frontend Setup

```powershell
cd frontend
npm install
```



---

## ▶️ Running the Application

Open **two separate PowerShell terminals**:

### Terminal 1 — Django Backend
```powershell
cd "C:\Users\Lenovo\Desktop\AI-inventory demand prediction\backend"
$env:DJANGO_SETTINGS_MODULE = "stockwise.settings"
..\venv\Scripts\python manage.py runserver 8001
```

### Terminal 2 — React Frontend
```powershell
cd "C:\Users\Lenovo\Desktop\AI-inventory demand prediction\frontend"
npm run dev
```

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login/` | JWT Login |
| POST | `/api/auth/register/` | User Registration |
| GET | `/api/auth/me/` | Current User |
| GET | `/api/dashboard/` | Dashboard metrics + charts data |
| GET/POST | `/api/products/` | List / Create products |
| GET/PUT/DELETE | `/api/products/{id}/` | Product detail |
| POST | `/api/products/{id}/adjust-stock/` | Stock adjustment |
| GET | `/api/products/{id}/movements/` | Stock movement history |
| GET | `/api/products/export-csv/` | Export inventory CSV |
| POST | `/api/products/import-csv/` | Import inventory CSV |
| GET/POST | `/api/categories/` | Categories |
| GET/POST | `/api/sales/` | Sales list / create |
| GET | `/api/sales/analytics/` | Sales analytics |
| GET | `/api/sales/export-csv/` | Export sales CSV |
| POST | `/api/forecast/generate/` | Generate AI forecast |
| GET | `/api/forecast/product/{id}/` | Product forecast detail |
| GET | `/api/forecast/history/` | Forecast run history |
| GET | `/api/recommendations/` | Reorder recommendations |
| POST | `/api/recommendations/{id}/review/` | Mark recommendation reviewed |
| GET/POST | `/api/suppliers/` | Suppliers |
| GET/PUT/DELETE | `/api/suppliers/{id}/` | Supplier detail |
| GET | `/api/reports/inventory/` | Inventory report |
| GET | `/api/reports/sales/` | Sales report |
| GET | `/api/reports/low-stock/` | Low stock report |
| GET | `/admin/` | Django Admin |

---

## 🤖 Forecasting Methodology

The AI demand forecasting engine (`backend/forecasting/ml_engine.py`) uses:

1. **Data preparation**: Daily sales aggregation with zero-fill for missing dates
2. **Sufficiency check**: Requires ≥ 28 days of history and ≥ 5 positive sales days for ML training
3. **Feature engineering**: Day-of-week, month, weekend flag, lag features (1, 7, 14 days), rolling statistics (7, 14 day mean/std)
4. **Model**: Random Forest Regressor (100 trees, max depth 6) — retrained on full data after validation
5. **Evaluation**: Chronological holdout (last 14 days or 20% of data) — **NOT random splitting** to respect time-series structure
6. **Metrics**: MAE, RMSE, MAPE, R²
7. **Baseline fallback**: 7-day moving average with weekend seasonality adjustment when data is insufficient — clearly labeled, never misrepresented as ML

---

## 🧪 Running Tests

```powershell
cd backend
..\venv\Scripts\python manage.py test
```

**10 Tests passing:**
- Product CRUD (create, read, update, delete)
- SKU uniqueness enforcement
- Stock adjustment (in, out, invalid overflow)
- Sale recording with stock deduction
- Prevention of overselling
- Sales analytics aggregation
- AI forecast with sufficient data (ML model)
- Baseline fallback with insufficient data
- Forecast API endpoint
- Unauthenticated access denial

---

## 🐞 Troubleshooting

| Problem | Solution |
|---------|---------|
| Port 8000 already in use | Use port 8001: `runserver 8001` and update `frontend/.env` |
| DJANGO_SETTINGS_MODULE conflict | Set explicitly: `$env:DJANGO_SETTINGS_MODULE = "stockwise.settings"` |
| Migrations not applied | Run `python manage.py migrate` |
| No data showing | Run `python manage.py seed_sample_data` |
| CORS errors | Ensure `CORS_ALLOW_ALL_ORIGINS = True` in `DEBUG` mode |
| JWT token expired | The frontend auto-refreshes tokens; re-login if persistent |

---

## 📝 Notes

- The sample data command seeds **8 products**, **430 sales records**, **4 suppliers**, and **pre-runs AI forecasting** for all products
- The `smart ambient lamp (new)` product intentionally has sparse data to demonstrate the baseline fallback mechanism
- Stock is **never automatically modified** by forecasting — only explicit sales or stock adjustments trigger changes
