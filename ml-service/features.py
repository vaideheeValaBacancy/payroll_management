"""
Phase 2 — Transaction Feature Matrix Engineering.

Transforms raw transaction records into numeric feature vectors that balance
individual worker historical baselines with macro-organizational metrics.

Feature vector (order is contractual — used by every model and SHAP):
    0  gross_inr               raw gross earnings
    1  gross_to_avg_ratio      current gross / employee rolling avg (individual baseline)
    2  gross_to_dept_ratio     current gross / department mean (macro baseline)
    3  routing_changed         1 if routing changed within 48h, else 0
    4  bank_account_new        1 if account created within 30 days, else 0
    5  shared_routing_count    employees sharing this routing hash (collusion proxy)
    6  dept_encoded            department -> dense integer
    7  routing_hash_embed      categorical hash of routing string -> bounded float
"""

import hashlib
import numpy as np

FEATURES = [
    "gross_inr",
    "gross_to_avg_ratio",
    "gross_to_dept_ratio",
    "routing_changed",
    "bank_account_new",
    "shared_routing_count",
    "dept_encoded",
    "routing_hash_embed",
]

# Human-readable labels for the four UI SHAP buckets
SHAP_LABELS = ["routingChange", "amountDeviation", "velocitySpike", "newBankAccount"]

DEPT_MAP = {"Engineering": 0, "Finance": 1, "Operations": 2, "Sales": 3, "HR": 4}


def _hash_embed(s: str, dim: int = 1000) -> float:
    """Categorical Hash Mapping (Phase 2): routing/swift string -> bounded float."""
    if not s:
        return 0.0
    h = int(hashlib.md5(s.encode()).hexdigest(), 16) % dim
    return h / dim  # normalized to [0, 1)


def build_vector(
    gross_inr: float,
    avg_monthly_pay: float,
    dept_mean_pay: float,
    routing_changed: bool,
    bank_account_new: bool,
    shared_routing_count: int,
    department: str,
    routing_hash: str = "",
) -> np.ndarray:
    """Single transaction -> (1, n_features) feature matrix row."""
    ratio_indiv = gross_inr / max(avg_monthly_pay, 1.0)
    ratio_macro = gross_inr / max(dept_mean_pay, 1.0)
    return np.array([[
        gross_inr,
        ratio_indiv,
        ratio_macro,
        float(int(routing_changed)),
        float(int(bank_account_new)),
        float(shared_routing_count),
        float(DEPT_MAP.get(department, 1)),
        _hash_embed(routing_hash),
    ]], dtype=float)


def feature_to_shap_buckets(importance: np.ndarray) -> dict:
    """
    Collapse the 8 model features into the 4 UI SHAP buckets the frontend renders.
        routingChange   <- routing_changed (3) + routing_hash_embed (7)
        amountDeviation <- gross_inr (0) + gross_to_avg_ratio (1) + gross_to_dept_ratio (2)
        velocitySpike   <- shared_routing_count (5) + dept_encoded (6)
        newBankAccount  <- bank_account_new (4)
    """
    buckets = {
        "routingChange":   float(importance[3] + importance[7]),
        "amountDeviation": float(importance[0] + importance[1] + importance[2]),
        "velocitySpike":   float(importance[5] + importance[6]),
        "newBankAccount":  float(importance[4]),
    }
    total = sum(buckets.values())
    if total > 0:
        buckets = {k: round(v / total, 4) for k, v in buckets.items()}
    return buckets
