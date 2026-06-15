#!/bin/bash
# Start the PayrollMonitor ML microservice
cd "$(dirname "$0")"

# Install deps if needed
if ! python3 -c "import sklearn" 2>/dev/null; then
  echo "Installing dependencies..."
  pip3 install -r requirements.txt
fi

echo "Starting ML service on http://localhost:8000"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
