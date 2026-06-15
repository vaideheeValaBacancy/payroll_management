#!/bin/bash
# Start the PayrollMonitor dual-model AI engine
cd "$(dirname "$0")"

# Create venv on first run
if [ ! -d "venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv venv
fi

# Install deps if scikit-learn missing
if ! ./venv/bin/python -c "import sklearn" 2>/dev/null; then
  echo "Installing dependencies..."
  ./venv/bin/pip install --upgrade pip
  ./venv/bin/pip install -r requirements.txt
fi

# XGBoost on macOS needs OpenMP runtime
if [[ "$OSTYPE" == "darwin"* ]]; then
  if ! brew list libomp >/dev/null 2>&1; then
    echo "Installing libomp (required by XGBoost on macOS)..."
    brew install libomp
  fi
fi

echo "Starting dual-model engine on http://localhost:8000"
./venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload
