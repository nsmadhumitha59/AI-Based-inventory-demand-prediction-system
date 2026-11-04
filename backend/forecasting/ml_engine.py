import numpy as np
import pandas as pd
from datetime import timedelta, date
from django.utils import timezone
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from inventory.models import Product
from sales.models import Sale
from .models import ForecastRun, ForecastResult, ReorderRecommendation

class NoSalesDataError(Exception):
    """Raised when a product has no historical sales records in the database."""
    pass

class DemandForecastEngine:
    def __init__(self, product: Product, horizon_days: int = 30):
        self.product = product
        self.horizon_days = int(horizon_days)

    def prepare_sales_series(self):
        """
        Retrieves all sales records for product, aggregates daily sales,
        and fills missing days with 0 sales for a continuous timeline.
        """
        sales_qs = Sale.objects.filter(product=self.product).values('sale_date', 'quantity')
        if not sales_qs.exists():
            return pd.DataFrame(columns=['date', 'quantity'])

        df = pd.DataFrame(list(sales_qs))
        df['date'] = pd.to_datetime(df['sale_date'])
        daily = df.groupby('date')['quantity'].sum().reset_index()
        daily = daily.sort_values('date').set_index('date')

        # Reindex to fill continuous date range from min date to today or latest sale
        start_date = daily.index.min()
        end_date = max(daily.index.max(), pd.to_datetime(timezone.now().date()))
        full_idx = pd.date_range(start_date, end_date, freq='D')
        daily = daily.reindex(full_idx, fill_value=0).rename_axis('date').reset_index()
        daily.columns = ['date', 'quantity']
        return daily

    def create_features(self, df):
        """
        Generates lag and calendar features for time-series forecasting.
        """
        df = df.copy()
        df['dayofweek'] = df['date'].dt.dayofweek
        df['day'] = df['date'].dt.day
        df['month'] = df['date'].dt.month
        df['is_weekend'] = df['dayofweek'].isin([5, 6]).astype(int)

        # Lags
        df['lag_1'] = df['quantity'].shift(1)
        df['lag_7'] = df['quantity'].shift(7)
        df['lag_14'] = df['quantity'].shift(14)

        # Rolling statistics
        df['rolling_mean_7'] = df['quantity'].shift(1).rolling(window=7, min_periods=1).mean()
        df['rolling_mean_14'] = df['quantity'].shift(1).rolling(window=14, min_periods=1).mean()
        df['rolling_std_7'] = df['quantity'].shift(1).rolling(window=7, min_periods=1).std().fillna(0)

        return df

    def run_forecast(self):
        """
        Executes the forecast:
        - Checks data existence and raises NoSalesDataError if product has no sales.
        - If >= 28 days of data and >= 5 positive sales: Trains Random Forest Regressor.
        - Evaluates model using chronological holdout test set (never random split).
        - If data is limited but present: uses 7-day Moving Average / Seasonal Baseline with honest indicators.
        - Computes reorder recommendation and returns full structured result.
        """
        sales_count = Sale.objects.filter(product=self.product).count()
        if sales_count == 0:
            raise NoSalesDataError(
                f"No historical sales data found for {self.product.name} ({self.product.sku}). "
                f"Please record sales transactions or import sales data via CSV before generating demand forecasts."
            )

        daily_df = self.prepare_sales_series()
        if daily_df.empty:
            raise NoSalesDataError(
                f"No valid sales data series could be constructed for {self.product.name} ({self.product.sku})."
            )

        total_days = len(daily_df)
        total_sales_units = float(daily_df['quantity'].sum())
        if total_sales_units <= 0:
            raise NoSalesDataError(
                f"Historical sales for {self.product.name} ({self.product.sku}) total 0 units. "
                f"At least one non-zero sales record is required to compute demand forecasts."
            )

        recorded_sales = daily_df[daily_df['quantity'] > 0]
        positive_days = len(recorded_sales)

        # Sufficiency threshold: At least 28 days of history and 5 days with sales
        is_sufficient = total_days >= 28 and positive_days >= 5

        today = timezone.now().date()
        future_dates = [today + timedelta(days=i) for i in range(1, self.horizon_days + 1)]

        predictions = []
        metrics = {}
        model_name = ""
        notes = ""

        if not is_sufficient:
            # Baseline Forecasting (Moving Average & Historical Daily Velocity)
            model_name = "Baseline (7-Day Moving Average & Historical Mean)"
            
            # Active daily velocity
            active_daily_mean = float(recorded_sales['quantity'].mean()) if positive_days > 0 else 1.0
            # Span daily average
            first_sale_date = recorded_sales['date'].min()
            last_sale_date = recorded_sales['date'].max()
            span_days = max(1, (last_sale_date - first_sale_date).days + 1)
            span_daily_rate = float(total_sales_units) / float(span_days)
            # Recent active moving average
            recent_active = float(recorded_sales.tail(7)['quantity'].mean()) if positive_days > 0 else active_daily_mean

            # Weighted base demand
            base_demand = round(float(0.5 * recent_active + 0.5 * span_daily_rate), 2)
            base_demand = max(0.1, base_demand)

            # Standard deviation for bounds
            std_dev = float(recorded_sales['quantity'].std()) if positive_days > 1 else max(0.5, round(base_demand * 0.35, 2))
            if np.isnan(std_dev) or std_dev <= 0:
                std_dev = max(0.5, round(base_demand * 0.35, 2))

            notes = (
                f"Historical sales data is limited and insufficient ({positive_days} active sales days, {int(total_sales_units)} total units sold over {span_days} days). "
                f"Baseline forecast calculated from moving average and daily velocity ({base_demand:.2f} units/day). "
                f"Minimum 28 days of history with >=5 sales days required for Random Forest ML training."
            )

            # Predict baseline with slight weekend seasonality
            for f_date in future_dates:
                multiplier = 1.15 if f_date.weekday() in (5, 6) else 0.95
                pred_val = round(max(0.1, base_demand * multiplier), 2)
                bound_margin = max(0.2, round(std_dev * 1.25, 2))
                lower = max(0.0, round(pred_val - min(pred_val * 0.7, bound_margin), 2))
                upper = round(max(pred_val + 0.1, pred_val + bound_margin), 2)
                predictions.append({
                    'date': f_date,
                    'predicted_quantity': pred_val,
                    'lower_bound': lower,
                    'upper_bound': upper
                })

            metrics = {
                'mae': None,
                'rmse': None,
                'mape': None,
                'r2': None,
                'method': 'Baseline Moving Average & Daily Sales Velocity',
                'historical_days': int(span_days),
                'positive_sales_days': int(positive_days),
                'total_units_sold': int(total_sales_units),
                'base_daily_demand': round(float(base_demand), 2)
            }
        else:
            # Sufficient data: Machine Learning with Random Forest Regressor
            model_name = "Random Forest Regressor (Time-Series Features)"
            featured_df = self.create_features(daily_df)
            clean_df = featured_df.dropna().copy()

            feature_cols = ['dayofweek', 'day', 'month', 'is_weekend', 'lag_1', 'lag_7', 'lag_14',
                            'rolling_mean_7', 'rolling_mean_14', 'rolling_std_7']

            # Chronological Holdout Validation (last 14 days or 20% of data, whichever is smaller)
            test_size = min(14, max(5, int(len(clean_df) * 0.2)))
            train_df = clean_df.iloc[:-test_size]
            test_df = clean_df.iloc[-test_size:]

            X_train, y_train = train_df[feature_cols], train_df['quantity']
            X_test, y_test = test_df[feature_cols], test_df['quantity']

            rf = RandomForestRegressor(n_estimators=100, max_depth=6, random_state=42)
            rf.fit(X_train, y_train)

            # Evaluate holdout metrics
            y_pred_test = rf.predict(X_test)
            y_pred_test = np.clip(y_pred_test, 0, None)

            mae = float(mean_absolute_error(y_test, y_pred_test))
            rmse = float(np.sqrt(mean_squared_error(y_test, y_pred_test)))
            # Safe MAPE calculation
            mask = y_test > 0
            if mask.sum() > 0:
                mape = float(np.mean(np.abs((y_test[mask] - y_pred_test[mask]) / y_test[mask])) * 100)
            else:
                mape = 0.0
            r2 = float(r2_score(y_test, y_pred_test)) if len(y_test) > 1 else 0.0

            metrics = {
                'mae': round(mae, 2),
                'rmse': round(rmse, 2),
                'mape': round(mape, 1),
                'r2': round(r2, 3),
                'evaluation_split': f"Chronological holdout on last {test_size} days",
                'historical_days': total_days,
                'positive_sales_days': int(positive_days)
            }

            # Retrain on full historical dataset for future generation
            rf.fit(clean_df[feature_cols], clean_df['quantity'])

            # Iterative multi-step forecasting
            sim_df = daily_df.copy()
            for f_date in future_dates:
                # Build feature row for f_date
                last_vals = sim_df['quantity'].values
                f_dow = f_date.weekday()
                f_day = f_date.day
                f_month = f_date.month
                f_is_wknd = 1 if f_dow in (5, 6) else 0

                lag_1 = last_vals[-1] if len(last_vals) >= 1 else 0
                lag_7 = last_vals[-7] if len(last_vals) >= 7 else lag_1
                lag_14 = last_vals[-14] if len(last_vals) >= 14 else lag_7

                roll_7 = float(np.mean(last_vals[-7:])) if len(last_vals) >= 7 else float(np.mean(last_vals))
                roll_14 = float(np.mean(last_vals[-14:])) if len(last_vals) >= 14 else float(np.mean(last_vals))
                roll_std_7 = float(np.std(last_vals[-7:])) if len(last_vals) >= 7 else 0.0

                row_feat = pd.DataFrame([{
                    'dayofweek': f_dow,
                    'day': f_day,
                    'month': f_month,
                    'is_weekend': f_is_wknd,
                    'lag_1': lag_1,
                    'lag_7': lag_7,
                    'lag_14': lag_14,
                    'rolling_mean_7': roll_7,
                    'rolling_mean_14': roll_14,
                    'rolling_std_7': roll_std_7,
                }])

                raw_pred = float(rf.predict(row_feat)[0])
                pred = max(0.1, round(raw_pred, 1))

                # Bounds estimation based on model RMSE (prediction interval)
                bound_delta = max(0.4, round(rmse * 1.28, 1))
                lower = max(0.0, round(pred - min(pred * 0.7, bound_delta), 1))
                upper = round(max(pred + 0.1, pred + bound_delta), 1)

                predictions.append({
                    'date': f_date,
                    'predicted_quantity': pred,
                    'lower_bound': lower,
                    'upper_bound': upper
                })

                # Append prediction to sim_df to carry forward for subsequent lags
                new_row = pd.DataFrame([{'date': pd.to_datetime(f_date), 'quantity': pred}])
                sim_df = pd.concat([sim_df, new_row], ignore_index=True)

            notes = (
                f"Trained Random Forest Regressor on {total_days} days of chronological sales history. "
                f"Validated on chronological holdout set (MAE: {metrics['mae']}, RMSE: {metrics['rmse']})."
            )

        # Persistence: save ForecastRun and ForecastResult
        run = ForecastRun.objects.create(
            product=self.product,
            horizon_days=self.horizon_days,
            model_name=model_name,
            evaluation_metrics=metrics,
            is_sufficient_data=is_sufficient,
            notes=notes
        )

        result_objects = [
            ForecastResult(
                forecast_run=run,
                date=p['date'],
                predicted_quantity=p['predicted_quantity'],
                lower_bound=p['lower_bound'],
                upper_bound=p['upper_bound']
            ) for p in predictions
        ]
        ForecastResult.objects.bulk_create(result_objects)

        # Generate Reorder Recommendation
        recommendation = self.compute_reorder_recommendation(run, predictions)

        return run, recommendation

    def compute_reorder_recommendation(self, forecast_run: ForecastRun, predictions: list):
        """
        Calculates actionable reorder recommendation:
        - Lead time demand: expected sales across supplier lead time days
        - Safety stock buffer
        - Estimated stockout date
        - Recommendation priority and rationale
        """
        lead_time = max(1, self.product.lead_time_days)
        safety_stock = self.product.safety_stock
        current_stock = self.product.current_stock
        reorder_level = self.product.reorder_level

        # Lead time demand
        lead_time_preds = predictions[:lead_time]
        forecast_lead_demand = sum(p['predicted_quantity'] for p in lead_time_preds)

        # Calculate estimated stockout date
        cum_demand = 0.0
        stockout_date = None
        for p in predictions:
            cum_demand += p['predicted_quantity']
            if cum_demand >= current_stock:
                stockout_date = p['date']
                break

        # Reorder calculation logic:
        # Reorder Point (ROP) = Lead Time Demand + Safety Stock
        reorder_point = forecast_lead_demand + safety_stock
        recommended_qty = 0
        priority = 'OPTIMAL'
        reasoning = []

        if current_stock <= 0:
            priority = 'CRITICAL'
            target_stock = int(np.ceil(forecast_lead_demand * 2 + safety_stock))
            recommended_qty = max(target_stock, reorder_level * 2)
            reasoning.append(f"Product is currently OUT OF STOCK (0 units). Immediate replenishment required.")
        elif stockout_date and (stockout_date - timezone.now().date()).days <= lead_time:
            priority = 'CRITICAL'
            needed = (forecast_lead_demand + safety_stock) - current_stock
            recommended_qty = int(np.ceil(max(needed * 1.5, reorder_level)))
            reasoning.append(
                f"High stockout risk! Predicted stockout on {stockout_date.strftime('%Y-%m-%d')} "
                f"which is within supplier lead time ({lead_time} days)."
            )
        elif current_stock <= reorder_point or current_stock <= reorder_level:
            priority = 'HIGH'
            needed = (forecast_lead_demand + safety_stock) - current_stock
            recommended_qty = int(np.ceil(max(needed, reorder_level)))
            reasoning.append(
                f"Current stock ({current_stock}) has breached the reorder threshold ({int(np.ceil(reorder_point))}). "
                f"Demand during {lead_time}-day lead time is projected at {forecast_lead_demand:.1f} units."
            )
        elif stockout_date and (stockout_date - timezone.now().date()).days <= lead_time * 2:
            priority = 'MEDIUM'
            recommended_qty = int(np.ceil(forecast_lead_demand + safety_stock))
            reasoning.append(
                f"Stock is currently sufficient ({current_stock} units), but projected to deplete around {stockout_date.strftime('%Y-%m-%d')}."
            )
        elif current_stock > max(reorder_level * 4, 150):
            priority = 'LOW'
            recommended_qty = 0
            reasoning.append(
                f"Inventory is heavily overstocked ({current_stock} units vs reorder level {reorder_level}). "
                f"No replenishment recommended."
            )
        else:
            priority = 'OPTIMAL'
            recommended_qty = 0
            reasoning.append(
                f"Inventory levels are healthy. Stock will cover projected demand beyond the lead time window."
            )

        reasoning_text = " ".join(reasoning)

        # Update or create recommendation record
        rec = ReorderRecommendation.objects.create(
            product=self.product,
            forecast_run=forecast_run,
            current_stock=current_stock,
            forecasted_demand_lead_time=round(forecast_lead_demand, 1),
            safety_stock=safety_stock,
            reorder_level=reorder_level,
            recommended_reorder_qty=recommended_qty,
            estimated_stockout_date=stockout_date,
            priority=priority,
            reasoning=reasoning_text
        )
        return rec
