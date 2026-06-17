# Starting the AI / ML Service — Simple Guide

This folder runs the "brain" of PayrollMonitor — the part that scores
transactions for fraud risk. The main app talks to it in the background.

You only need to follow the steps below. Copy and paste the commands exactly.

---

## Before you start (one-time setup)

You need **two free programs** installed on your computer. If you already have
them, skip ahead.

### 1. Python (version 3.13)

- **Mac/Windows:** Download from <https://www.python.org/downloads/> and run the
  installer. On Windows, **tick the box that says "Add Python to PATH"** during
  install.
- To check it worked, open a terminal and type:
  ```
  python3 --version
  ```
  You should see something like `Python 3.13.0`.

### 2. (Mac only) Homebrew

The AI engine needs one extra helper called `libomp` on Mac. Homebrew installs it
for you automatically. If you don't have Homebrew, install it by pasting this
into the terminal:

```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

> On Windows or Linux you don't need this step.

---

## How to open a terminal

- **Mac:** Press `Cmd + Space`, type **Terminal**, press Enter.
- **Windows:** Press the Start button, type **PowerShell**, press Enter.

---

## Start the service

### On Mac or Linux

Paste these two lines into the terminal, one at a time, pressing Enter after each:

```
cd path/to/payroll_management/ml-service
./start.sh
```

> Replace `path/to/payroll_management` with where the project folder actually is.
> Tip: type `cd ` (with a space), then drag the `ml-service` folder into the
> terminal window — it fills in the path for you. Then press Enter.

The **first time** you run this, it will take a few minutes — it's downloading and
setting things up. That's normal. You'll know it's ready when you see:

```
Starting dual-model engine on http://localhost:8000
```

**Leave this terminal window open.** Closing it stops the service.

### On Windows

Paste these lines one at a time:

```
cd path\to\payroll_management\ml-service
python3 -m venv venv
venv\Scripts\pip install --upgrade pip
venv\Scripts\pip install -r requirements.txt
venv\Scripts\uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The first run takes a few minutes. When you see
`Starting dual-model engine on http://localhost:8000`, it's working. Keep the
window open.

---

## Did it work?

Open a web browser and go to:

<http://localhost:8000/health>

If you see a page full of text and numbers (model details), 🎉 it's running.

---

## Common problems

| What you see | What to do |
|---|---|
| `command not found: python3` | Python isn't installed (or not added to PATH on Windows). Re-do the Python step above. |
| It hangs or errors on first run (Mac) | Make sure Homebrew is installed (see setup step 2), then run `./start.sh` again. |
| `Permission denied` when running `./start.sh` (Mac) | Run `chmod +x start.sh` once, then try again. |
| Page won't load at the health link | Check the terminal is still open and shows the "Starting..." line. If it closed, start it again. |

---

## How to stop it

Click on the terminal window and press `Ctrl + C`. Or just close the window.

---

## A note if you copied this from someone else's computer

If you copied the whole project folder from another machine, **delete the `venv`
folder inside `ml-service` first** — it's tied to the original computer and won't
work on yours. The `start.sh` script will build a fresh one for you. (On Windows,
just delete the `venv` folder in File Explorer.)
