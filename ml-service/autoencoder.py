"""
Phase 3 — Reconstruction Autoencoder (pure NumPy).

A symmetric autoencoder that learns to reconstruct *normal* payroll transactions.
Anomalous transactions reconstruct poorly -> high reconstruction error -> high
anomaly score. This is the deep unsupervised variance-flagging model from the
spec's Stack Reference, implemented without PyTorch so it runs on Python 3.13.

Architecture:  8 -> 4 -> 2 (bottleneck) -> 4 -> 8
Activation:    tanh on hidden layers, linear output
Training:      full-batch gradient descent on MSE reconstruction loss
"""

import numpy as np


def _tanh(x):
    return np.tanh(x)


def _dtanh(x):
    return 1.0 - np.tanh(x) ** 2


class ReconstructionAutoencoder:
    def __init__(self, n_features: int, hidden: int = 4, bottleneck: int = 2, seed: int = 42):
        rng = np.random.default_rng(seed)
        # He-ish init scaled for tanh
        def init(a, b):
            return rng.standard_normal((a, b)) * np.sqrt(1.0 / a)

        self.W1 = init(n_features, hidden);   self.b1 = np.zeros(hidden)
        self.W2 = init(hidden, bottleneck);   self.b2 = np.zeros(bottleneck)
        self.W3 = init(bottleneck, hidden);   self.b3 = np.zeros(hidden)
        self.W4 = init(hidden, n_features);   self.b4 = np.zeros(n_features)

        self.mean_ = None
        self.std_  = None
        self.error_mean_ = 0.0
        self.error_std_  = 1.0

    # ── forward pass ────────────────────────────────────────────────────────
    def _forward(self, X):
        z1 = X @ self.W1 + self.b1; a1 = _tanh(z1)   # encode 1
        z2 = a1 @ self.W2 + self.b2; a2 = _tanh(z2)  # bottleneck
        z3 = a2 @ self.W3 + self.b3; a3 = _tanh(z3)  # decode 1
        out = a3 @ self.W4 + self.b4                  # linear reconstruction
        cache = (X, z1, a1, z2, a2, z3, a3, out)
        return out, cache

    # ── training ────────────────────────────────────────────────────────────
    def fit(self, X_raw, epochs: int = 400, lr: float = 0.05):
        # standardize features
        self.mean_ = X_raw.mean(axis=0)
        self.std_  = X_raw.std(axis=0) + 1e-8
        X = (X_raw - self.mean_) / self.std_
        n = X.shape[0]

        for _ in range(epochs):
            out, (X_, z1, a1, z2, a2, z3, a3, _o) = self._forward(X)
            # MSE gradient
            d_out = (out - X) * (2.0 / n)

            dW4 = a3.T @ d_out;            db4 = d_out.sum(axis=0)
            da3 = d_out @ self.W4.T;       dz3 = da3 * _dtanh(z3)
            dW3 = a2.T @ dz3;              db3 = dz3.sum(axis=0)
            da2 = dz3 @ self.W3.T;         dz2 = da2 * _dtanh(z2)
            dW2 = a1.T @ dz2;              db2 = dz2.sum(axis=0)
            da1 = dz2 @ self.W2.T;         dz1 = da1 * _dtanh(z1)
            dW1 = X_.T @ dz1;             db1 = dz1.sum(axis=0)

            for p, g in [(self.W4, dW4), (self.b4, db4), (self.W3, dW3), (self.b3, db3),
                         (self.W2, dW2), (self.b2, db2), (self.W1, dW1), (self.b1, db1)]:
                p -= lr * g

        # calibrate error distribution on training set (for normalized scoring)
        errs = self._reconstruction_error(X_raw)
        self.error_mean_ = float(errs.mean())
        self.error_std_  = float(errs.std() + 1e-8)
        return self

    # ── scoring ─────────────────────────────────────────────────────────────
    def _reconstruction_error(self, X_raw):
        X = (X_raw - self.mean_) / self.std_
        out, _ = self._forward(X)
        return np.mean((out - X) ** 2, axis=1)

    def anomaly_score(self, X_raw) -> np.ndarray:
        """Return [0,1] anomaly score from reconstruction error via sigmoid of z-score."""
        errs = self._reconstruction_error(X_raw)
        z = (errs - self.error_mean_) / self.error_std_
        return 1.0 / (1.0 + np.exp(-z))  # sigmoid -> [0,1]

    def per_feature_error(self, X_raw) -> np.ndarray:
        """Squared error per feature for the first row — used for SHAP-style attribution."""
        X = (X_raw - self.mean_) / self.std_
        out, _ = self._forward(X)
        return ((out - X) ** 2)[0]

    # ── serialization ───────────────────────────────────────────────────────
    def to_dict(self):
        return {
            "W1": self.W1, "b1": self.b1, "W2": self.W2, "b2": self.b2,
            "W3": self.W3, "b3": self.b3, "W4": self.W4, "b4": self.b4,
            "mean_": self.mean_, "std_": self.std_,
            "error_mean_": self.error_mean_, "error_std_": self.error_std_,
        }

    @classmethod
    def from_dict(cls, d, n_features):
        ae = cls(n_features)
        for k, v in d.items():
            setattr(ae, k, v)
        return ae
