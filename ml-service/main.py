"""
PayrollMonitor — Dual-Model AI Anomaly Detection Engine
Implements the spec (TM-PA-OPS-001) Phase 3 dual-model topology:

  UNSUPERVISED:
    • Isolation Forest      s(x,n) = 2^(-E(h(x)) / c(n))
    • Reconstruction Autoencoder (NumPy)   reconstruction-error scoring
  SUPERVISED:
    • XGBoost classifier    fraud / not-fraud probability
  XAI (Phase 8):
    • SHAP TreeExplainer over the XGBoost model

  ENSEMBLE: final score = weighted blend of the three model outputs.

Endpoints:
  POST /score   — score one transaction (≤220ms target, Phase 5 calibration)
  POST /train   — train all three models on transaction history
  GET  /health  — model metadata, versions, feature importance
"""

import os
import json
import time
import math
import pickle
import hashlib
import logging
import datetime
from pathlib import Path
from typing import Optional

import numpy as np
import shap
import xgboost as xgb
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

from features import FEATURES, build_vector, feature_to_shap_buckets
from autoencoder import ReconstructionAutoencoder

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("ml-service")

app = FastAPI(title="PayrollMonitor Dual-Model Engine", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["*"], allow_headers=["*"],
)

MODEL_PATH = Path(__file__).parent / "model.pkl"
META_PATH  = Path(__file__).parent / "model_meta.json"

# Ensemble weights — when a supervised model is trained it is the most
# discriminative signal, so it carries the most weight. The unsupervised
# models (Isolation Forest + Autoencoder) catch novel patterns the labels
# never saw. When XGBoost is absent its weight is redistributed (see _score).
W_IFOREST = 0.25
W_AUTOENC = 0.25
W_XGBOOST = 0.50

# ── In-memory model state ──────────────────────────────────────────────────
_iforest:  Optional[IsolationForest] = None
_autoenc:  Optional[ReconstructionAutoencoder] = None
_xgb:      Optional[xgb.XGBClassifier] = None
_scaler:   Optional[StandardScaler] = None
_explainer = None
_meta: dict = {}


# ── Isolation Forest spec formula  s(x,n) = 2^(-E(h(x))/c(n)) ───────────────
def _c(n: int) -> float:
    if n <= 1:
        return 1.0
    return 2.0 * (math.log(n - 1) + 0.5772156649) - (2.0 * (n - 1) / n)


def _iforest_spec_score(model: IsolationForest, X: np.ndarray, n_samples: int) -> float:
    """Convert sklearn score_samples back to the spec's normalized formula."""
    cn = _c(n_samples)
    raw = float(model.score_samples(X)[0])  # = -E(h(x)) / c(n)
    e_hx = -raw * cn
    s = 2 ** (-e_hx / cn) if cn > 0 else 0.5
    return float(np.clip(s, 0.0, 1.0))


# ── Persistence ────────────────────────────────────────────────────────────
def _save():
    bundle = {
        "iforest":   _iforest,
        "autoenc":   _autoenc.to_dict() if _autoenc else None,
        "xgb":       _xgb,
        "scaler":    _scaler,
        "meta":      _meta,
        "explainer_bg": getattr(_explainer, "data", None) if _explainer is not None else None,
    }
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(bundle, f)
    with open(META_PATH, "w") as f:
        json.dump(_meta, f, indent=2)


def _load():
    global _iforest, _autoenc, _xgb, _scaler, _explainer, _meta
    if not MODEL_PATH.exists():
        log.info("No saved model — will use rule fallback until /train.")
        return
    with open(MODEL_PATH, "rb") as f:
        b = pickle.load(f)
    _iforest = b["iforest"]
    _autoenc = ReconstructionAutoencoder.from_dict(b["autoenc"], len(FEATURES)) if b["autoenc"] else None
    _xgb     = b["xgb"]
    _scaler  = b["scaler"]
    _meta    = b.get("meta", {})
    if _xgb is not None:
        _explainer = shap.TreeExplainer(_xgb)
    log.info("Models loaded. Version %s", _meta.get("version"))


# ── Rule fallback (used when no model trained yet) ─────────────────────────
def _rule_fallback(gross, avg, routing, newbank, shared, thresholds):
    score = 0.0
    shap_vals = {"routingChange": 0.0, "amountDeviation": 0.0, "velocitySpike": 0.0, "newBankAccount": 0.0}
    reasons = []
    if routing:
        score += 0.35; shap_vals["routingChange"] = 0.35; reasons.append("routing_number_changed_48h")
    ratio = gross / max(avg, 1.0)
    if ratio > 2.5:
        dev = min((ratio - 2.5) / 2.5, 1.0) * 0.25
        score += dev; shap_vals["amountDeviation"] = round(dev, 4); reasons.append("amount_exceeds_2.5x_median")
    if newbank:
        score += 0.20; shap_vals["newBankAccount"] = 0.20; reasons.append("new_bank_account_detected")
    if shared > 1:
        ring = min(shared * 0.10, 0.30)
        score += ring; shap_vals["velocitySpike"] = round(ring, 4); reasons.append(f"shared_routing_hash_{shared}_employees")
    score = min(score, 1.0)
    q, r = thresholds.get("quarantine", 0.75), thresholds.get("review", 0.50)
    return {
        "anomalyScore": round(score, 4),
        "riskLevel": "CRITICAL" if score >= q else "HIGH" if score >= r else "MEDIUM" if score >= 0.25 else "LOW",
        "status": "QUARANTINED" if score >= q else "MANUAL_REVIEW" if score >= r else "CLEARED",
        "flagReasons": reasons,
        "shapContributions": shap_vals,
        "modelVersion": "rule-fallback",
        "modelScores": {"iforest": None, "autoencoder": None, "xgboost": None},
        "inferenceMs": 0,
    }


# ── Schemas ─────────────────────────────────────────────────────────────────
class ScoreRequest(BaseModel):
    employeeId: str
    grossInr: float
    avgMonthlyPay: float
    deptMeanPay: float = 0.0
    routingChangedWithin48h: bool
    isBankAccountNew: bool
    sharedRoutingHashCount: int
    department: str
    routingHash: str = ""
    thresholds: dict = {"quarantine": 0.75, "review": 0.50}


class TrainSample(BaseModel):
    grossInr: float
    avgMonthlyPay: float
    deptMeanPay: float = 0.0
    routingChangedWithin48h: bool
    isBankAccountNew: bool
    sharedRoutingHashCount: int
    department: str
    routingHash: str = ""
    isAnomaly: Optional[bool] = None  # supervised label (None = unlabelled)


class TrainRequest(BaseModel):
    samples: list[TrainSample]
    contamination: float = 0.08


# ── Lifecycle ───────────────────────────────────────────────────────────────
@app.on_event("startup")
def startup():
    _load()


@app.get("/health")
def health():
    return {
        "status": "ok",
        "modelLoaded": _iforest is not None,
        "modelVersion": _meta.get("version"),
        "trainedAt": _meta.get("trainedAt"),
        "nSamples": _meta.get("nSamples"),
        "models": {
            "isolationForest": _iforest is not None,
            "autoencoder": _autoenc is not None,
            "xgboost": _xgb is not None,
        },
        "ensembleWeights": {"isolationForest": W_IFOREST, "autoencoder": W_AUTOENC, "xgboost": W_XGBOOST},
        "features": FEATURES,
        "featureImportance": _meta.get("featureImportance", {}),
    }


@app.post("/score")
def score(req: ScoreRequest):
    t0 = time.perf_counter()
    q = req.thresholds.get("quarantine", 0.75)
    r = req.thresholds.get("review", 0.50)

    if _iforest is None:
        out = _rule_fallback(req.grossInr, req.avgMonthlyPay, req.routingChangedWithin48h,
                             req.isBankAccountNew, req.sharedRoutingHashCount, req.thresholds)
        out["inferenceMs"] = round((time.perf_counter() - t0) * 1000, 2)
        return out

    dept_mean = req.deptMeanPay if req.deptMeanPay > 0 else req.avgMonthlyPay
    X_raw = build_vector(
        req.grossInr, req.avgMonthlyPay, dept_mean,
        req.routingChangedWithin48h, req.isBankAccountNew,
        req.sharedRoutingHashCount, req.department, req.routingHash,
    )
    X = _scaler.transform(X_raw)

    # ── Model 1: Isolation Forest (spec formula) ────────────────────────────
    s_if = _iforest_spec_score(_iforest, X, _meta.get("nSamples", 100))

    # ── Model 2: Reconstruction Autoencoder ─────────────────────────────────
    s_ae = float(_autoenc.anomaly_score(X_raw)[0]) if _autoenc else s_if

    # ── Model 3: XGBoost supervised classifier ──────────────────────────────
    s_xgb = float(_xgb.predict_proba(X)[0][1]) if _xgb else None

    # ── Ensemble (redistribute XGBoost weight when unsupervised-only) ────────
    if s_xgb is not None:
        anomaly = W_IFOREST * s_if + W_AUTOENC * s_ae + W_XGBOOST * s_xgb
    else:
        # No supervised model — split its weight across the two unsupervised models
        w_if = W_IFOREST + W_XGBOOST / 2
        w_ae = W_AUTOENC + W_XGBOOST / 2
        anomaly = w_if * s_if + w_ae * s_ae
    anomaly = float(np.clip(anomaly, 0.0, 1.0))

    # ── SHAP attribution (Phase 8 XAI) over XGBoost ─────────────────────────
    shap_buckets = {"routingChange": 0.0, "amountDeviation": 0.0, "velocitySpike": 0.0, "newBankAccount": 0.0}
    if _explainer is not None:
        try:
            sv = _explainer.shap_values(X)
            sv_row = sv[0] if isinstance(sv, np.ndarray) and sv.ndim == 2 else np.array(sv).reshape(-1)
            shap_buckets = feature_to_shap_buckets(np.abs(sv_row))
        except Exception as e:
            log.warning("SHAP failed: %s", e)
    elif _autoenc is not None:
        # autoencoder per-feature error as fallback attribution
        shap_buckets = feature_to_shap_buckets(_autoenc.per_feature_error(X_raw))

    # ── Flag reasons ────────────────────────────────────────────────────────
    reasons = []
    if req.routingChangedWithin48h: reasons.append("routing_number_changed_48h")
    if req.grossInr / max(req.avgMonthlyPay, 1.0) > 2.5: reasons.append("amount_exceeds_2.5x_median")
    if req.isBankAccountNew: reasons.append("new_bank_account_detected")
    if req.sharedRoutingHashCount > 1: reasons.append(f"shared_routing_hash_{req.sharedRoutingHashCount}_employees")
    if anomaly >= 0.70 and not reasons: reasons.append("ensemble_anomaly_pattern")

    status = "QUARANTINED" if anomaly >= q else "MANUAL_REVIEW" if anomaly >= r else "CLEARED"
    risk   = "CRITICAL" if anomaly >= q else "HIGH" if anomaly >= r else "MEDIUM" if anomaly >= 0.25 else "LOW"

    return {
        "anomalyScore": round(anomaly, 4),
        "riskLevel": risk,
        "status": status,
        "flagReasons": reasons,
        "shapContributions": shap_buckets,
        "modelVersion": _meta.get("version", "dual-model"),
        "modelScores": {
            "iforest": round(s_if, 4),
            "autoencoder": round(s_ae, 4),
            "xgboost": round(s_xgb, 4) if s_xgb is not None else None,
        },
        "inferenceMs": round((time.perf_counter() - t0) * 1000, 2),
    }


@app.post("/train")
def train(req: TrainRequest):
    global _iforest, _autoenc, _xgb, _scaler, _explainer, _meta
    if len(req.samples) < 10:
        raise HTTPException(400, "Need at least 10 samples to train")

    t0 = time.perf_counter()

    rows, labels = [], []
    for s in req.samples:
        dm = s.deptMeanPay if s.deptMeanPay > 0 else s.avgMonthlyPay
        rows.append(build_vector(
            s.grossInr, s.avgMonthlyPay, dm,
            s.routingChangedWithin48h, s.isBankAccountNew,
            s.sharedRoutingHashCount, s.department, s.routingHash,
        )[0])
        labels.append(1 if s.isAnomaly else 0)

    X_raw = np.array(rows)
    y = np.array(labels)

    _scaler = StandardScaler()
    X = _scaler.fit_transform(X_raw)
    contamination = min(max(req.contamination, 0.01), 0.5)

    # ── Train Isolation Forest ──────────────────────────────────────────────
    _iforest = IsolationForest(n_estimators=200, contamination=contamination,
                               max_features=len(FEATURES), random_state=42, n_jobs=-1)
    _iforest.fit(X)

    # ── Train Autoencoder on (predominantly normal) data ────────────────────
    _autoenc = ReconstructionAutoencoder(len(FEATURES))
    _autoenc.fit(X_raw, epochs=400, lr=0.05)

    # ── Train XGBoost supervised classifier (if both classes present) ────────
    feat_importance = {}
    if y.sum() >= 2 and (len(y) - y.sum()) >= 2:
        _xgb = xgb.XGBClassifier(
            n_estimators=120, max_depth=4, learning_rate=0.1,
            scale_pos_weight=max((len(y) - y.sum()) / max(y.sum(), 1), 1.0),
            eval_metric="logloss", random_state=42,
        )
        _xgb.fit(X, y)
        _explainer = shap.TreeExplainer(_xgb)
        sv = _explainer.shap_values(X)
        imp = np.abs(sv).mean(axis=0)
        feat_importance = feature_to_shap_buckets(imp)
    else:
        # Not enough labels for supervised — derive importance from IF + autoencoder
        _xgb = None
        _explainer = None
        imp = _autoenc.per_feature_error(X_raw[:1].repeat(1, axis=0))
        feat_importance = feature_to_shap_buckets(np.abs(imp))
        log.info("Skipped XGBoost — insufficient labeled fraud samples (%d positive)", int(y.sum()))

    elapsed = round((time.perf_counter() - t0) * 1000, 1)
    _meta = {
        "version": hashlib.md5(str(time.time()).encode()).hexdigest()[:8],
        "trainedAt": datetime.datetime.utcnow().isoformat() + "Z",
        "nSamples": len(X_raw),
        "nLabeledFraud": int(y.sum()),
        "contamination": contamination,
        "trainingMs": elapsed,
        "models": {"isolationForest": True, "autoencoder": True, "xgboost": _xgb is not None},
        "featureImportance": feat_importance,
    }
    _save()
    log.info("Trained dual-model v%s | %d samples | %d fraud | %.0fms",
             _meta["version"], len(X_raw), int(y.sum()), elapsed)

    return {"success": True, **_meta}
