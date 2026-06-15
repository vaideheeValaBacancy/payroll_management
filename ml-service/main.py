"""
PayrollMonitor — Isolation Forest Anomaly Detection Microservice
POST /score   — score a single transaction
POST /train   — retrain model on provided dataset
GET  /health  — liveness + model metadata
"""

import os
import json
import time
import math
import pickle
import hashlib
import logging
from pathlib import Path
from typing import Optional

import numpy as np
import shap
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("ml-service")

app = FastAPI(title="PayrollMonitor ML Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = Path(__file__).parent / "model.pkl"
META_PATH  = Path(__file__).parent / "model_meta.json"

# ---------------------------------------------------------------------------
# Feature schema — order matters, must match training and scoring
# ---------------------------------------------------------------------------
FEATURES = [
    "gross_inr",            # raw gross earnings
    "gross_to_avg_ratio",   # gross / employee avg monthly pay
    "routing_changed",      # 1 if changed within 48h, else 0
    "bank_account_new",     # 1 if new account, else 0
    "shared_routing_count", # number of employees sharing routing hash
    "dept_encoded",         # department as integer (Engineering=0, Finance=1, Operations=2)
]

DEPT_MAP = {"Engineering": 0, "Finance": 1, "Operations": 2}

# ---------------------------------------------------------------------------
# In-memory state
# ---------------------------------------------------------------------------
_model: Optional[IsolationForest] = None
_scaler: Optional[StandardScaler] = None
_explainer = None
_meta: dict = {}


def _c(n: int) -> float:
    """Average path length of unsuccessful BST search — used in IF score formula."""
    if n <= 1:
        return 0.0
    return 2.0 * (math.log(n - 1) + 0.5772156649) - (2.0 * (n - 1) / n)


def _isolation_score(raw_score: float, n_samples: int) -> float:
    """
    Convert sklearn's decision_function output to the spec formula:
        s(x, n) = 2^(-E(h(x)) / c(n))
    sklearn returns:  decision_function = -1 * (E(h(x)) - c(n)) / c(n)
    We recover E(h(x)) and apply the spec formula.
    """
    cn = _c(n_samples)
    if cn == 0:
        return 0.5
    # sklearn decision_function = score_samples + 0.5 (offset varies by version)
    # Use score_samples directly: score_samples = -mean_path_length / c(n)
    # So E(h(x)) = -raw_score * c(n)
    e_hx = -raw_score * cn
    s = 2 ** (-e_hx / cn)
    return float(np.clip(s, 0.0, 1.0))


def _load_model():
    global _model, _scaler, _explainer, _meta
    if MODEL_PATH.exists():
        with open(MODEL_PATH, "rb") as f:
            bundle = pickle.load(f)
        _model   = bundle["model"]
        _scaler  = bundle["scaler"]
        _meta    = bundle.get("meta", {})
        # Rebuild SHAP explainer from saved background data
        bg = bundle.get("background")
        if bg is not None:
            _explainer = shap.TreeExplainer(_model, bg)
        log.info("Model loaded from disk. Version: %s", _meta.get("version", "unknown"))
    else:
        log.info("No saved model found — will use fallback rules until /train is called")


def _save_model(background):
    with open(MODEL_PATH, "wb") as f:
        pickle.dump({"model": _model, "scaler": _scaler, "meta": _meta, "background": background}, f)
    with open(META_PATH, "w") as f:
        json.dump(_meta, f, indent=2)


def _feature_vector(
    gross_inr: float,
    avg_monthly_pay: float,
    routing_changed: bool,
    bank_account_new: bool,
    shared_routing_count: int,
    department: str,
) -> np.ndarray:
    dept = DEPT_MAP.get(department, 1)
    ratio = gross_inr / max(avg_monthly_pay, 1.0)
    return np.array([[
        gross_inr,
        ratio,
        int(routing_changed),
        int(bank_account_new),
        shared_routing_count,
        dept,
    ]], dtype=float)


def _rule_fallback(
    gross_inr: float,
    avg_monthly_pay: float,
    routing_changed: bool,
    bank_account_new: bool,
    shared_routing_count: int,
    thresholds: dict,
) -> dict:
    """Original rule engine — used when model not yet trained."""
    score = 0.0
    shap_vals = {"routingChange": 0.0, "amountDeviation": 0.0, "velocitySpike": 0.0, "newBankAccount": 0.0}
    reasons = []

    if routing_changed:
        score += 0.35; shap_vals["routingChange"] = 0.35
        reasons.append("routing_number_changed_48h")

    ratio = gross_inr / max(avg_monthly_pay, 1.0)
    if ratio > 2.5:
        dev = min((ratio - 2.5) / 2.5, 1.0) * 0.25
        score += dev; shap_vals["amountDeviation"] = round(dev, 4)
        reasons.append("amount_exceeds_2.5x_median")

    if bank_account_new:
        score += 0.20; shap_vals["newBankAccount"] = 0.20
        reasons.append("new_bank_account_detected")

    if shared_routing_count > 1:
        ring = min(shared_routing_count * 0.10, 0.30)
        score += ring; shap_vals["velocitySpike"] = round(ring, 4)
        reasons.append(f"shared_routing_hash_{shared_routing_count}_employees")

    score = min(score, 1.0)
    q, r = thresholds.get("quarantine", 0.75), thresholds.get("review", 0.50)
    return {
        "anomalyScore": round(score, 4),
        "riskLevel": "CRITICAL" if score >= q else "HIGH" if score >= r else "MEDIUM" if score >= 0.25 else "LOW",
        "status": "QUARANTINED" if score >= q else "MANUAL_REVIEW" if score >= r else "CLEARED",
        "flagReasons": reasons,
        "shapContributions": shap_vals,
        "modelVersion": "rule-fallback",
        "inferenceMs": 0,
    }


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------
class ScoreRequest(BaseModel):
    employeeId: str
    grossInr: float
    avgMonthlyPay: float
    routingChangedWithin48h: bool
    isBankAccountNew: bool
    sharedRoutingHashCount: int
    department: str
    thresholds: dict = {"quarantine": 0.75, "review": 0.50}


class TrainSample(BaseModel):
    grossInr: float
    avgMonthlyPay: float
    routingChangedWithin48h: bool
    isBankAccountNew: bool
    sharedRoutingHashCount: int
    department: str
    isAnomaly: Optional[bool] = None  # None = unlabelled (unsupervised)


class TrainRequest(BaseModel):
    samples: list[TrainSample]
    contamination: float = 0.08  # expected fraud rate ~8%


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.on_event("startup")
def startup():
    _load_model()


@app.get("/health")
def health():
    return {
        "status": "ok",
        "modelLoaded": _model is not None,
        "modelVersion": _meta.get("version"),
        "trainedAt": _meta.get("trainedAt"),
        "nSamples": _meta.get("nSamples"),
        "features": FEATURES,
        "featureImportance": _meta.get("featureImportance", {}),
    }


@app.post("/score")
def score(req: ScoreRequest):
    t0 = time.perf_counter()
    q = req.thresholds.get("quarantine", 0.75)
    r = req.thresholds.get("review", 0.50)

    if _model is None:
        # No trained model yet — fall back to rule engine
        result = _rule_fallback(
            req.grossInr, req.avgMonthlyPay,
            req.routingChangedWithin48h, req.isBankAccountNew,
            req.sharedRoutingHashCount, req.thresholds
        )
        result["inferenceMs"] = round((time.perf_counter() - t0) * 1000, 2)
        return result

    X_raw = _feature_vector(
        req.grossInr, req.avgMonthlyPay,
        req.routingChangedWithin48h, req.isBankAccountNew,
        req.sharedRoutingHashCount, req.department,
    )
    X = _scaler.transform(X_raw)

    # Isolation Forest score — convert to [0,1] anomaly probability
    raw = float(_model.score_samples(X)[0])
    n_samples = _meta.get("nSamples", 100)
    anomaly_score = _isolation_score(raw, n_samples)

    # Real SHAP values
    shap_raw = None
    if _explainer is not None:
        try:
            sv = _explainer.shap_values(X)
            # sv shape: (1, n_features) — normalize to [0,1] range
            sv_abs = np.abs(sv[0])
            sv_sum = sv_abs.sum()
            if sv_sum > 0:
                sv_norm = sv_abs / sv_sum
            else:
                sv_norm = sv_abs
            shap_raw = {
                "routingChange":   round(float(sv_norm[2]), 4),  # routing_changed
                "amountDeviation": round(float(sv_norm[1]), 4),  # gross_to_avg_ratio
                "velocitySpike":   round(float(sv_norm[4]), 4),  # shared_routing_count
                "newBankAccount":  round(float(sv_norm[3]), 4),  # bank_account_new
            }
        except Exception as e:
            log.warning("SHAP computation failed: %s", e)

    # Build flag reasons from feature values
    reasons = []
    if req.routingChangedWithin48h:
        reasons.append("routing_number_changed_48h")
    ratio = req.grossInr / max(req.avgMonthlyPay, 1.0)
    if ratio > 2.5:
        reasons.append("amount_exceeds_2.5x_median")
    if req.isBankAccountNew:
        reasons.append("new_bank_account_detected")
    if req.sharedRoutingHashCount > 1:
        reasons.append(f"shared_routing_hash_{req.sharedRoutingHashCount}_employees")
    if anomaly_score >= 0.70 and not reasons:
        reasons.append("isolation_forest_anomaly_pattern")

    # Default SHAP if explainer not available
    if shap_raw is None:
        shap_raw = {"routingChange": 0.0, "amountDeviation": 0.0, "velocitySpike": 0.0, "newBankAccount": 0.0}

    status = "QUARANTINED" if anomaly_score >= q else "MANUAL_REVIEW" if anomaly_score >= r else "CLEARED"
    risk   = "CRITICAL"    if anomaly_score >= q else "HIGH"          if anomaly_score >= r else "MEDIUM" if anomaly_score >= 0.25 else "LOW"

    inference_ms = round((time.perf_counter() - t0) * 1000, 2)

    return {
        "anomalyScore":      round(anomaly_score, 4),
        "riskLevel":         risk,
        "status":            status,
        "flagReasons":       reasons,
        "shapContributions": shap_raw,
        "modelVersion":      _meta.get("version", "unknown"),
        "inferenceMs":       inference_ms,
    }


@app.post("/train")
def train(req: TrainRequest):
    global _model, _scaler, _explainer, _meta

    if len(req.samples) < 10:
        raise HTTPException(400, "Need at least 10 samples to train")

    t0 = time.perf_counter()

    rows = []
    for s in req.samples:
        rows.append(_feature_vector(
            s.grossInr, s.avgMonthlyPay,
            s.routingChangedWithin48h, s.isBankAccountNew,
            s.sharedRoutingHashCount, s.department,
        )[0])

    X_raw = np.array(rows)

    _scaler = StandardScaler()
    X = _scaler.fit_transform(X_raw)

    contamination = min(max(req.contamination, 0.01), 0.5)
    _model = IsolationForest(
        n_estimators=200,
        contamination=contamination,
        max_features=len(FEATURES),
        random_state=42,
        n_jobs=-1,
    )
    _model.fit(X)

    # SHAP explainer — use 50 background samples (or all if fewer)
    bg_size = min(50, len(X))
    bg_idx  = np.random.choice(len(X), bg_size, replace=False)
    background = X[bg_idx]
    _explainer = shap.TreeExplainer(_model, background)

    # Feature importance via mean absolute SHAP across training set
    sv = _explainer.shap_values(X)
    importance = np.abs(sv).mean(axis=0)
    importance_norm = importance / importance.sum() if importance.sum() > 0 else importance
    feat_importance = {FEATURES[i]: round(float(importance_norm[i]), 4) for i in range(len(FEATURES))}

    elapsed = round((time.perf_counter() - t0) * 1000, 1)

    import datetime
    _meta = {
        "version":           hashlib.md5(str(time.time()).encode()).hexdigest()[:8],
        "trainedAt":         datetime.datetime.utcnow().isoformat() + "Z",
        "nSamples":          len(X_raw),
        "contamination":     contamination,
        "trainingMs":        elapsed,
        "featureImportance": feat_importance,
    }

    _save_model(background)
    log.info("Model trained. Version: %s  Samples: %d  Time: %.0fms", _meta["version"], len(X_raw), elapsed)

    return {"success": True, **_meta}
